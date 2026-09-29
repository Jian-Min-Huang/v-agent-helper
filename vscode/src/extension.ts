import * as vscode from "vscode";
import type { SupportedAgent } from "./core/agent";
import { sendReference, type SendResult } from "./core/sendReference";
import type { ReferenceInput } from "./core/reference";
import { AgentTerminalRegistry, type AgentRecipient } from "./vscode/terminalRegistry";

const SEND_CODEX_COMMAND = "agentHelper.sendToCodex";
const SEND_CLAUDE_CODE_COMMAND = "agentHelper.sendToClaudeCode";
const SHOW_STATE_COMMAND = "agentHelper.showDetectionState";
const OUTPUT_CHANNEL = "Agent Helper";

const AGENT_NAMES: Record<SupportedAgent, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
};

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel(OUTPUT_CHANNEL, { log: true });
  const registry = new AgentTerminalRegistry(log);

  context.subscriptions.push(
    log,
    registry,
    vscode.commands.registerCommand(SEND_CODEX_COMMAND, () => sendActiveReference("codex", registry, log)),
    vscode.commands.registerCommand(SEND_CLAUDE_CODE_COMMAND, () =>
      sendActiveReference("claude-code", registry, log)),
    vscode.commands.registerCommand(SHOW_STATE_COMMAND, async () => {
      await registry.scan("codex");
      await registry.scan("claude-code");
      log.show(true);
    }),
  );

  log.info(`Activated at ${new Date().toISOString()}`);
}

async function sendActiveReference(
  agent: SupportedAgent,
  registry: AgentTerminalRegistry,
  log: vscode.LogOutputChannel,
): Promise<void> {
  const agentName = AGENT_NAMES[agent];
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || !isSupportedDocument(editor.document)) {
    await vscode.window.showWarningMessage("Open a saved local or remote workspace file first.");
    return;
  }

  const result = await sendReference(referenceInput(editor), agent, {
    save: async () => editor.document.save(),
    recipients: async () => (await registry.scan(agent)).recipients,
    send: async (recipient, reference) => {
      await recipient.send(reference);
      log.info(`Sent ${JSON.stringify(reference)} to ${agentName} ${recipient.name}`);
    },
  });

  await report(result, agentName, log);
}

function referenceInput(editor: vscode.TextEditor): ReferenceInput {
  return {
    filePath: editor.document.uri.fsPath,
    workspaceRoots: vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [],
    selection: {
      start: {
        line: editor.selection.start.line,
        character: editor.selection.start.character,
      },
      end: {
        line: editor.selection.end.line,
        character: editor.selection.end.character,
      },
    },
  };
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === "file" || document.uri.scheme === "vscode-remote";
}

async function report(
  result: SendResult<AgentRecipient>,
  agentName: string,
  log: vscode.LogOutputChannel,
): Promise<void> {
  if (result.status === "save-failed") {
    await vscode.window.showErrorMessage(`Send to ${agentName} failed because the active file could not be saved.`);
    return;
  }
  if (result.status === "no-recipients") {
    const action = await vscode.window.showWarningMessage(
      `No running ${agentName} instance was detected in this VS Code window.`,
      "Show Detection State",
    );
    if (action === "Show Detection State") {
      log.show(true);
    }
    return;
  }
  if (result.failures.length > 0) {
    for (const failure of result.failures) {
      log.error(`Failed to send to ${failure.recipient.name}: ${errorMessage(failure.error)}`);
    }
    const action = await vscode.window.showErrorMessage(
      `Send to ${agentName} failed for ${result.failures.length} of ${result.recipientCount} ${agentName} instances.`,
      "Show Log",
    );
    if (action === "Show Log") {
      log.show(true);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function deactivate(): void {
  // VS Code disposes everything registered in ExtensionContext.subscriptions.
}
