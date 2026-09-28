import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type * as vscode from "vscode";
import type { ProcessSnapshot } from "../core/detection";

const execFileAsync = promisify(execFile);
const MAX_PROCESS_TABLE_BYTES = 8 * 1024 * 1024;

export async function readProcessTable(log: vscode.OutputChannel): Promise<readonly ProcessSnapshot[]> {
  try {
    return process.platform === "win32"
      ? await readWindowsProcessTable()
      : await readPosixProcessTable();
  } catch (error) {
    log.appendLine(`[process:error] ${errorMessage(error)}`);
    return [];
  }
}

async function readPosixProcessTable(): Promise<readonly ProcessSnapshot[]> {
  const { stdout } = await execFileAsync("ps", ["-Ao", "pid=,ppid=,command="], {
    maxBuffer: MAX_PROCESS_TABLE_BYTES,
  });
  return stdout
    .split(/\r?\n/u)
    .map(parsePosixProcess)
    .filter((entry): entry is ProcessSnapshot => entry !== undefined);
}

async function readWindowsProcessTable(): Promise<readonly ProcessSnapshot[]> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
    "Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CommandLine, ExecutablePath | ConvertTo-Json -Compress",
  ].join("; ");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    { maxBuffer: MAX_PROCESS_TABLE_BYTES },
  );
  const parsed: unknown = JSON.parse(stdout);
  const records = Array.isArray(parsed) ? parsed : [parsed];
  return records.flatMap(parseWindowsProcess);
}

function parsePosixProcess(line: string): ProcessSnapshot | undefined {
  const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
  if (match === null) {
    return undefined;
  }
  return {
    pid: Number(match[1]),
    parentPid: Number(match[2]),
    command: match[3],
  };
}

function parseWindowsProcess(value: unknown): ProcessSnapshot[] {
  if (!isRecord(value)) {
    return [];
  }
  const pid = numberValue(value.ProcessId);
  const parentPid = numberValue(value.ParentProcessId);
  const command = stringValue(value.CommandLine) ?? stringValue(value.ExecutablePath);
  return pid === undefined || parentPid === undefined || command === undefined
    ? []
    : [{ pid, parentPid, command }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
