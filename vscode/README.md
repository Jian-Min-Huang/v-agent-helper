# Agent Helper for VS Code

Agent Helper sends the active editor file and selected line range to supported coding agents running in the current VS Code window's integrated Terminal. Codex CLI and Claude Code are supported.

Select some lines and choose **Send to Codex ⌨️** or **Send to Claude Code ⌨️**. Each matching agent input receives an agent-specific Reference, such as `src/Foo.ts#L10-L20` for Codex or `@src/Foo.ts#L10-L20` for Claude Code. The text is inserted but not submitted, and focus stays in the editor.

## Local installation

### Install the included VSIX

1. Open VS Code.
2. Open the Command Palette with **Cmd+Shift+P** on macOS or **Ctrl+Shift+P** on Windows/Linux.
3. Run **Extensions: Install from VSIX...**.
4. Select `vscode/agent-helper-0.1.0.vsix` from this repository.
5. Reload VS Code when prompted.

The equivalent terminal command is:

```sh
cd vscode
code --install-extension ./agent-helper-0.1.0.vsix --force
```

If you previously installed the POC, remove its old extension ID first so the two versions do not appear side by side:

```sh
code --uninstall-extension jianminhuang.codex-helper-poc
code --install-extension ./agent-helper-0.1.0.vsix --force
```

## Usage

1. Start `codex` or `claude` in one or more integrated Terminal tabs.
2. Open a saved file and optionally select some lines.
3. Choose **Send to Codex ⌨️** or **Send to Claude Code ⌨️** from the editor context menu, or run it from the Command Palette.

There is no default keyboard shortcut. Search for either command in **Keyboard Shortcuts** to add one.

### What gets sent

| Selection | Codex | Claude Code |
|---|---|---|
| None | `src/Foo.ts` | `@src/Foo.ts` |
| Within one line | `src/Foo.ts#L12` | `@src/Foo.ts#L12` |
| Across lines | `src/Foo.ts#L10-L20` | `@src/Foo.ts#L10-L20` |

- The active file is saved before the Reference is sent.
- A path containing whitespace is wrapped in double quotes, with the line range outside the quotes.
- One leading and one trailing space keep the Reference separate from an existing draft.
- No Enter key is sent, so the agent does not run until you submit the input yourself.
- In a single-folder workspace, paths are relative to that folder. Multi-root workspaces use absolute paths so every Broadcast recipient gets a usable identical Reference.

### Which agent instances receive it

Each send command broadcasts once to every matching agent instance it detects in the current VS Code window. **Send to Codex** only targets Codex, and **Send to Claude Code** only targets Claude Code. Plain shells and the other agent type are not recipients. Detection uses:

- VS Code shell-integration command start/end events.
- A process-tree fallback for agents already running before extension activation or terminals without shell integration.
- `ps` on macOS/Linux and PowerShell CIM on Windows.

Run **Agent Helper: Show Detection State** from the Command Palette to inspect Terminal names, PIDs, and detection sources in the **Agent Helper** output channel.

## Requirements

- VS Code 1.93 or later on desktop, Remote SSH, Dev Container, or WSL.
- Codex CLI or Claude Code.
- A saved local or remote-workspace file. Browser-only virtual workspaces such as `vscode.dev` are not supported.

## Development

```sh
cd vscode
npm install
npm run check
code .
```

Press **F5** to open an Extension Development Host with the extension loaded.

The core behavior is tested through three interfaces: Reference construction, agent terminal detection, and Broadcast delivery. VS Code and operating-system process discovery are adapters around those modules.

## Manual release

1. Update `version` in `package.json` and run `npm install` to update `package-lock.json`.
2. Verify and package:

   ```sh
   cd vscode
   npm ci
   npm run check
   npm run package
   ```

3. Install the generated `agent-helper-VERSION.vsix` locally and repeat the Usage checks above.
4. Commit the release version and create a tag named `vscode-vVERSION`.
5. Create a GitHub Release manually and upload the generated VSIX.

Publishing to the VS Code Marketplace is intentionally separate from this manual GitHub Release flow and requires a Marketplace publisher account.

## Uninstall

Open the Extensions view, find **Agent Helper**, and choose **Uninstall**. The command-line equivalent is:

```sh
code --uninstall-extension jianminhuang.agent-helper
```

## Known limitations

- VS Code's `Terminal.sendText` does not acknowledge that the terminal application consumed the input. A missing error means the extension attempted the delivery, not that the agent confirmed receipt.
- Terminal process discovery depends on process information being visible to the VS Code extension host.

Agent Helper is an independent extension and is not affiliated with or endorsed by OpenAI or Anthropic.
