import type { SupportedAgent } from "./agent";

export type { SupportedAgent } from "./agent";

interface AgentCommandSpec {
  readonly executableName: string;
  readonly npmPackage: string;
}

const AGENT_COMMAND_SPECS: Record<SupportedAgent, AgentCommandSpec> = {
  codex: {
    executableName: "codex",
    npmPackage: "@openai/codex",
  },
  "claude-code": {
    executableName: "claude",
    npmPackage: "@anthropic-ai/claude-code",
  },
};

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

export interface AgentDetection<T> {
  readonly terminal: T;
  readonly sources: readonly DetectionSource[];
}

export function detectAgentTerminals<T>(
  agent: SupportedAgent,
  snapshot: DetectionSnapshot<T>,
): readonly AgentDetection<T>[] {
  const children = childrenByParent(snapshot.processes);
  const processByPid = new Map(snapshot.processes.map(process => [process.pid, process]));

  return snapshot.terminals.flatMap(terminal => {
    const sources: DetectionSource[] = [];
    if (terminal.activeCommand !== undefined && isAgentCommand(agent, terminal.activeCommand)) {
      sources.push("shell integration");
    }
    if (
      terminal.rootPid !== undefined &&
      processTreeContainsAgent(agent, terminal.rootPid, processByPid, children)
    ) {
      sources.push("process tree");
    }
    return sources.length === 0 ? [] : [{ terminal: terminal.terminal, sources }];
  });
}

export function detectCodexTerminals<T>(snapshot: DetectionSnapshot<T>): readonly AgentDetection<T>[] {
  return detectAgentTerminals("codex", snapshot);
}

export function detectClaudeCodeTerminals<T>(snapshot: DetectionSnapshot<T>): readonly AgentDetection<T>[] {
  return detectAgentTerminals("claude-code", snapshot);
}

export function isCodexCommand(command: string): boolean {
  return isAgentCommand("codex", command);
}

export function isClaudeCodeCommand(command: string): boolean {
  return isAgentCommand("claude-code", command);
}

function isAgentCommand(agent: SupportedAgent, command: string): boolean {
  const spec = AGENT_COMMAND_SPECS[agent];
  const tokens = command.trim().match(/"[^"]*"|'[^']*'|\S+/gu) ?? [];
  const firstToken = tokens[0];
  if (firstToken === undefined) {
    return false;
  }

  const executable = firstToken.replace(/^['"]|['"]$/gu, "");
  const executableName = executable.split(/[\\/]/u).at(-1)?.toLowerCase();
  return executableName === spec.executableName ||
    executableName === `${spec.executableName}.exe` ||
    executableName === `${spec.executableName}.cmd` ||
    tokens.some(token => isNpmPackageToken(token, spec.npmPackage)) ||
    ((executableName === "node" || executableName === "node.exe") &&
      tokens.slice(1).some(token => isInstalledPackagePath(token, spec.npmPackage)));
}

function isNpmPackageToken(token: string, npmPackage: string): boolean {
  const normalized = token.replace(/^['"]|['"]$/gu, "");
  return normalized === npmPackage || normalized.startsWith(`${npmPackage}@`);
}

function isInstalledPackagePath(token: string, npmPackage: string): boolean {
  const normalized = token.replace(/^['"]|['"]$/gu, "").replaceAll("\\", "/");
  return normalized.includes(`/${npmPackage}/`);
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

function processTreeContainsAgent(
  agent: SupportedAgent,
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
    if (process !== undefined && isAgentCommand(agent, process.command)) {
      return true;
    }
    pending.push(...(children.get(pid) ?? []));
  }
  return false;
}
