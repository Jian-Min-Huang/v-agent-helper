import * as vscode from "vscode";
import {
  detectCodexTerminals,
  type DetectionSource,
  type TerminalSnapshot,
} from "../core/detection";
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

export interface TerminalScan {
  readonly recipients: readonly vscode.Terminal[];
  readonly diagnostics: readonly TerminalDiagnostic[];
}

export class CodexTerminalRegistry implements vscode.Disposable {
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

  public async scan(): Promise<TerminalScan> {
    const [processes, terminals] = await Promise.all([
      readProcessTable(this.log),
      Promise.all(vscode.window.terminals.map(terminal => this.snapshot(terminal))),
    ]);
    const detections = detectCodexTerminals({ terminals, processes });
    const sourcesByTerminal = new Map(detections.map(detection => [detection.terminal, detection.sources]));
    const diagnostics = terminals.map(snapshot => ({
      name: snapshot.terminal.name,
      pid: snapshot.rootPid,
      sources: sourcesByTerminal.get(snapshot.terminal) ?? [],
    }));

    this.writeState(diagnostics);
    return {
      recipients: detections.map(detection => detection.terminal),
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

  private writeState(diagnostics: readonly TerminalDiagnostic[]): void {
    this.log.appendLine(`[state] ${new Date().toISOString()}`);
    if (diagnostics.length === 0) {
      this.log.appendLine("  no open terminals");
      return;
    }
    for (const diagnostic of diagnostics) {
      const state = diagnostic.sources.length === 0
        ? "not Codex"
        : `Codex via ${diagnostic.sources.join(" + ")}`;
      this.log.appendLine(`  ${diagnostic.name} pid=${String(diagnostic.pid)}: ${state}`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
