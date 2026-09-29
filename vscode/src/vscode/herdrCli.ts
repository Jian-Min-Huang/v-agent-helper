import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseHerdrAgentList, type HerdrAgent, type HerdrSession } from "../core/herdr";

const execFileAsync = promisify(execFile);
const HERDR_TIMEOUT_MS = 5_000;
const MAX_HERDR_OUTPUT_BYTES = 8 * 1024 * 1024;

export async function listHerdrAgents(session: HerdrSession): Promise<readonly HerdrAgent[]> {
  return parseHerdrAgentList(await runHerdr(session, ["agent", "list"]));
}

export async function sendHerdrText(session: HerdrSession, paneId: string, text: string): Promise<void> {
  await runHerdr(session, ["pane", "send-text", paneId, text]);
}

async function runHerdr(session: HerdrSession, args: readonly string[]): Promise<string> {
  const sessionArgs = session.name === undefined ? [] : ["--session", session.name];
  try {
    const { stdout } = await execFileAsync(session.executable, [...sessionArgs, ...args], {
      timeout: HERDR_TIMEOUT_MS,
      maxBuffer: MAX_HERDR_OUTPUT_BYTES,
    });
    return stdout;
  } catch (error) {
    throw new Error(`herdr ${args.slice(0, 2).join(" ")} failed: ${herdrFailure(error)}`);
  }
}

function herdrFailure(error: unknown): string {
  const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr).trim() : "";
  if (stderr.length > 0) {
    try {
      const parsed: unknown = JSON.parse(stderr);
      const message = (parsed as { error?: { message?: unknown } }).error?.message;
      if (typeof message === "string") {
        return message;
      }
    } catch {
      // herdr reports syntax errors as plain text.
    }
    return stderr;
  }
  return error instanceof Error ? error.message : String(error);
}
