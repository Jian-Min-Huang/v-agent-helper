const CODEX_NPM_PACKAGE = "@openai/codex";

export type DetectionSource = "shell integration" | "process tree";

export interface TerminalSnapshot<T> {
  readonly terminal: T;
  readonly activeCommand?: string;
  readonly rootPid?: number;
}

export interface ProcessSnapshot {
  readonly pid: number;
  readonly parentPid: number;
  readonly command: string;
}

export interface DetectionSnapshot<T> {
  readonly terminals: readonly TerminalSnapshot<T>[];
  readonly processes: readonly ProcessSnapshot[];
}

export interface CodexDetection<T> {
  readonly terminal: T;
  readonly sources: readonly DetectionSource[];
}

export function detectCodexTerminals<T>(snapshot: DetectionSnapshot<T>): readonly CodexDetection<T>[] {
  const children = childrenByParent(snapshot.processes);
  const processByPid = new Map(snapshot.processes.map(process => [process.pid, process]));

  return snapshot.terminals.flatMap(terminal => {
    const sources: DetectionSource[] = [];
    if (terminal.activeCommand !== undefined && isCodexCommand(terminal.activeCommand)) {
      sources.push("shell integration");
    }
    if (terminal.rootPid !== undefined && processTreeContainsCodex(terminal.rootPid, processByPid, children)) {
      sources.push("process tree");
    }
    return sources.length === 0 ? [] : [{ terminal: terminal.terminal, sources }];
  });
}

export function isCodexCommand(command: string): boolean {
  const tokens = command.trim().match(/"[^"]*"|'[^']*'|\S+/gu) ?? [];
  const firstToken = tokens[0];
  if (firstToken === undefined) {
    return false;
  }

  const executable = firstToken.replace(/^['"]|['"]$/gu, "");
  const executableName = executable.split(/[\\/]/u).at(-1)?.toLowerCase();
  return executableName === "codex" || executableName === "codex.exe" ||
    tokens.some(token => token === CODEX_NPM_PACKAGE || token.startsWith(`${CODEX_NPM_PACKAGE}@`)) ||
    ((executableName === "node" || executableName === "node.exe") && tokens.slice(1).some(isInstalledCodexPath));
}

function isInstalledCodexPath(token: string): boolean {
  const normalized = token.replace(/^['"]|['"]$/gu, "").replaceAll("\\", "/");
  return normalized.includes(`/${CODEX_NPM_PACKAGE}/`);
}

function childrenByParent(processes: readonly ProcessSnapshot[]): ReadonlyMap<number, readonly number[]> {
  const children = new Map<number, number[]>();
  for (const process of processes) {
    const childPids = children.get(process.parentPid) ?? [];
    childPids.push(process.pid);
    children.set(process.parentPid, childPids);
  }
  return children;
}

function processTreeContainsCodex(
  rootPid: number,
  processByPid: ReadonlyMap<number, ProcessSnapshot>,
  children: ReadonlyMap<number, readonly number[]>,
): boolean {
  const pending = [rootPid];
  const visited = new Set<number>();
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined || visited.has(pid)) {
      continue;
    }
    visited.add(pid);

    const process = processByPid.get(pid);
    if (process !== undefined && isCodexCommand(process.command)) {
      return true;
    }
    pending.push(...(children.get(pid) ?? []));
  }
  return false;
}
