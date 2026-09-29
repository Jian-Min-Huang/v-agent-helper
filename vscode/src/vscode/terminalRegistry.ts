import * as vscode from "vscode";
import type { SupportedAgent } from "../core/agent";
import {
  detectAgentTerminals,
  type DetectionSource,
  type TerminalSnapshot,
} from "../core/detection";
import {
  findHerdrSessions,
  matchHerdrAgent,
  type HerdrAgent,
  type HerdrSession,
} from "../core/herdr";
import { listHerdrAgents, sendHerdrText } from "./herdrCli";
import { readProcessTable } from "./processTable";

interface LiveExecution {
  readonly execution: vscode.TerminalShellExecution;
  readonly command: string;
}

export interface TerminalDiagnostic {
  readonly name: string;
  readonly pid: number | undefined;
  readonly sources: readonly DetectionSource[];
}

export interface AgentRecipient {
  readonly name: string;
  send(reference: string): Promise<void>;
}

interface HerdrSessionScan {
  readonly session: HerdrSession;
  readonly agents: readonly HerdrAgent[];
  readonly error?: string;
}

export interface TerminalScan {
  readonly recipients: readonly AgentRecipient[];
  readonly diagnostics: readonly TerminalDiagnostic[];
}

export class AgentTerminalRegistry implements vscode.Disposable {
  private readonly liveExecutions = new Map<vscode.Terminal, LiveExecution>();
  private readonly disposables: vscode.Disposable[];

  public constructor(private readonly log: vscode.OutputChannel) {
    this.disposables = [
      vscode.window.onDidStartTerminalShellExecution(event => {
        const command = event.execution.commandLine.value;
        this.liveExecutions.set(event.terminal, { execution: event.execution, command });
        this.log.appendLine(`[shell:start] ${event.terminal.name}: ${command}`);
      }),
      vscode.window.onDidEndTerminalShellExecution(event => {
        if (this.liveExecutions.get(event.terminal)?.execution === event.execution) {
          this.liveExecutions.delete(event.terminal);
        }
        this.log.appendLine(
          `[shell:end] ${event.terminal.name}: ${event.execution.commandLine.value} (exit=${String(event.exitCode)})`,
        );
      }),
      vscode.window.onDidCloseTerminal(terminal => {
        this.liveExecutions.delete(terminal);
      }),
    ];
  }

  public async scan(agent: SupportedAgent): Promise<TerminalScan> {
    const [processes, terminals] = await Promise.all([
      readProcessTable(this.log),
      Promise.all(vscode.window.terminals.map(terminal => this.snapshot(terminal))),
    ]);
    const detections = detectAgentTerminals(agent, { terminals, processes });
    const sourcesByTerminal = new Map(detections.map(detection => [detection.terminal, detection.sources]));
    const diagnostics = terminals.map(snapshot => ({
      name: snapshot.terminal.name,
      pid: snapshot.rootPid,
      sources: sourcesByTerminal.get(snapshot.terminal) ?? [],
    }));
    const herdrSessions = await Promise.all(
      findHerdrSessions({ terminals, processes }).map(session => scanHerdrSession(session)),
    );
    const workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];

    this.writeState(agent, diagnostics, herdrSessions, workspaceRoots);
    return {
      recipients: [
        ...detections.map(detection => terminalRecipient(detection.terminal)),
        ...herdrSessions.flatMap(scan => scan.agents
          .filter(herdrAgent => matchHerdrAgent(agent, herdrAgent, workspaceRoots) === "recipient")
          .map(herdrAgent => herdrRecipient(scan.session, herdrAgent))),
      ],
      diagnostics,
    };
  }

  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.liveExecutions.clear();
  }

  private async snapshot(terminal: vscode.Terminal): Promise<TerminalSnapshot<vscode.Terminal>> {
    let rootPid: number | undefined;
    try {
      rootPid = await terminal.processId;
    } catch (error) {
      this.log.appendLine(`[terminal:error] ${terminal.name}: ${errorMessage(error)}`);
    }
    return {
      terminal,
      rootPid,
      activeCommand: this.liveExecutions.get(terminal)?.command,
    };
  }

  private writeState(
    agent: SupportedAgent,
    diagnostics: readonly TerminalDiagnostic[],
    herdrSessions: readonly HerdrSessionScan[],
    workspaceRoots: readonly string[],
  ): void {
    const agentName = displayName(agent);
    this.log.appendLine(`[state:${agent}] ${new Date().toISOString()}`);
    if (diagnostics.length === 0) {
      this.log.appendLine("  no open terminals");
      return;
    }
    for (const diagnostic of diagnostics) {
      const state = diagnostic.sources.length === 0
        ? `not ${agentName}`
        : `${agentName} via ${diagnostic.sources.join(" + ")}`;
      this.log.appendLine(`  ${diagnostic.name} pid=${String(diagnostic.pid)}: ${state}`);
    }
    for (const scan of herdrSessions) {
      if (scan.error !== undefined) {
        this.log.appendLine(`  ${herdrSessionName(scan.session)}: ${scan.error}`);
        continue;
      }
      this.log.appendLine(`  ${herdrSessionName(scan.session)}: ${scan.agents.length} agent(s)`);
      for (const herdrAgent of scan.agents) {
        const match = matchHerdrAgent(agent, herdrAgent, workspaceRoots);
        const state = match === "recipient"
          ? `${agentName} via herdr`
          : match === "other agent" ? `not ${agentName}` : `${agentName} outside workspace`;
        this.log.appendLine(
          `    pane ${herdrAgent.paneId} ${herdrAgent.kind} cwd=${String(herdrAgent.cwd)}: ${state}`,
        );
      }
    }
  }
}

async function scanHerdrSession(session: HerdrSession): Promise<HerdrSessionScan> {
  try {
    return { session, agents: await listHerdrAgents(session) };
  } catch (error) {
    return { session, agents: [], error: errorMessage(error) };
  }
}

function terminalRecipient(terminal: vscode.Terminal): AgentRecipient {
  return {
    name: `terminal ${terminal.name}`,
    send: async reference => terminal.sendText(reference, false),
  };
}

function herdrRecipient(session: HerdrSession, herdrAgent: HerdrAgent): AgentRecipient {
  return {
    name: `${herdrSessionName(session)} pane ${herdrAgent.paneId}`,
    send: reference => sendHerdrText(session, herdrAgent.paneId, reference),
  };
}

function herdrSessionName(session: HerdrSession): string {
  return `herdr session ${session.name ?? "default"}`;
}

function displayName(agent: SupportedAgent): string {
  return agent === "codex" ? "Codex" : "Claude Code";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
