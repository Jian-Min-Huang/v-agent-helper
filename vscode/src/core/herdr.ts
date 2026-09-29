import type { SupportedAgent } from "./agent";
import {
  commandTokens,
  executableNameOf,
  indexProcessTree,
  unquote,
  type DetectionSnapshot,
} from "./detection";
import { isWithinRoot } from "./reference";

const DEFAULT_SESSION = "default";

const HERDR_AGENT_KINDS: Record<SupportedAgent, string> = {
  codex: "codex",
  "claude-code": "claude",
};

export interface HerdrSession {
  readonly executable: string;
  readonly name?: string;
}

export interface HerdrAgent {
  readonly kind: string;
  readonly paneId: string;
  readonly cwd?: string;
  readonly title?: string;
}

export function findHerdrSessions<T>(snapshot: DetectionSnapshot<T>): readonly HerdrSession[] {
  const processTree = indexProcessTree(snapshot.processes);
  const sessions = new Map<string, HerdrSession>();
  for (const terminal of snapshot.terminals) {
    if (terminal.rootPid === undefined) {
      continue;
    }
    for (const process of processTree.descendants(terminal.rootPid)) {
      const session = parseHerdrClient(process.command);
      if (session !== undefined && !sessions.has(session.name ?? "")) {
        sessions.set(session.name ?? "", session);
      }
    }
  }
  return [...sessions.values()];
}

export function parseHerdrAgentList(stdout: string): readonly HerdrAgent[] {
  const parsed: unknown = JSON.parse(stdout);
  const agents = isRecord(parsed) && isRecord(parsed.result) ? parsed.result.agents : undefined;
  return Array.isArray(agents) ? agents.flatMap(parseHerdrAgent) : [];
}

export type HerdrAgentMatch = "recipient" | "other agent" | "outside workspace";

export function matchHerdrAgent(
  agent: SupportedAgent,
  candidate: HerdrAgent,
  workspaceRoots: readonly string[],
): HerdrAgentMatch {
  if (candidate.kind !== HERDR_AGENT_KINDS[agent]) {
    return "other agent";
  }
  return isInWorkspace(candidate.cwd, workspaceRoots) ? "recipient" : "outside workspace";
}

function isInWorkspace(cwd: string | undefined, workspaceRoots: readonly string[]): boolean {
  if (workspaceRoots.length === 0) {
    return true;
  }
  return cwd !== undefined && workspaceRoots.some(root => isWithinRoot(cwd, root));
}

function parseHerdrClient(command: string): HerdrSession | undefined {
  const [executable, ...args] = commandTokens(command).map(unquote);
  if (executable === undefined || !["herdr", "herdr.exe"].includes(executableNameOf(executable) ?? "")) {
    return undefined;
  }

  let name: string | undefined;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--remote" || arg.startsWith("--remote=") || arg === "--machine" || arg.startsWith("--machine=")) {
      return undefined;
    }
    if (arg === "--session") {
      name = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--session=")) {
      name = arg.slice("--session=".length);
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length === 3 && positional[0] === "session" && positional[1] === "attach") {
    name = positional[2];
  } else if (positional.length > 0) {
    return undefined;
  }
  return name === undefined || name === DEFAULT_SESSION ? { executable } : { executable, name };
}

function parseHerdrAgent(value: unknown): HerdrAgent[] {
  if (!isRecord(value)) {
    return [];
  }
  const kind = stringValue(value.agent);
  const paneId = stringValue(value.pane_id);
  if (kind === undefined || paneId === undefined) {
    return [];
  }
  const cwd = stringValue(value.foreground_cwd) ?? stringValue(value.cwd);
  const title = stringValue(value.terminal_title_stripped);
  return [{
    kind,
    paneId,
    ...(cwd === undefined ? {} : { cwd }),
    ...(title === undefined ? {} : { title }),
  }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
