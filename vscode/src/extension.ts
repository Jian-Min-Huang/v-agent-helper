import * as vscode from "vscode";
import { sendReference, type SendResult } from "./core/sendReference";
import type { ReferenceInput } from "./core/reference";
import { CodexTerminalRegistry } from "./vscode/terminalRegistry";

const SEND_COMMAND = "codexHelper.sendToCodex";
const SHOW_STATE_COMMAND = "codexHelper.showDetectionState";
const OUTPUT_CHANNEL = "Codex Helper";

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel(OUTPUT_CHANNEL, { log: true });
  const registry = new CodexTerminalRegistry(log);

  context.subscriptions.push(
    log,
    registry,
    vscode.commands.registerCommand(SEND_COMMAND, () => sendActiveReference(registry, log)),
    vscode.commands.registerCommand(SHOW_STATE_COMMAND, async () => {
      await registry.scan();
      log.show(true);
    }),
  );

  log.info(`Activated at ${new Date().toISOString()}`);
}

async function sendActiveReference(
  registry: CodexTerminalRegistry,
  log: vscode.LogOutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || !isSupportedDocument(editor.document)) {
    await vscode.window.showWarningMessage("Open a saved local or remote workspace file first.");
    return;
  }

  const result = await sendReference(referenceInput(editor), {
    save: async () => editor.document.save(),
    recipients: async () => (await registry.scan()).recipients,
    send: (terminal, reference) => {
      terminal.sendText(reference, false);
      log.info(`Sent ${JSON.stringify(reference)} to ${terminal.name}`);
    },
  });

  await report(result, log);
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
  result: SendResult<vscode.Terminal>,
  log: vscode.LogOutputChannel,
): Promise<void> {
  if (result.status === "save-failed") {
    await vscode.window.showErrorMessage("Send to Codex failed because the active file could not be saved.");
    return;
  }
  if (result.status === "no-recipients") {
    const action = await vscode.window.showWarningMessage(
      "No running Codex instance was detected in this VS Code window.",
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
      `Send to Codex failed for ${result.failures.length} of ${result.recipientCount} Codex instances.`,
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
