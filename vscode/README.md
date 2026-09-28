# Codex Helper for VS Code

Send the active editor file and selected line range to every Codex CLI instance running in the current VS Code window's integrated Terminal.

Select some lines and choose **Send to Codex ✨**. Each Codex input receives the same Reference, such as `src/Foo.ts#L10-L20`. The text is inserted but not submitted, and focus stays in the editor.

## Local installation

### Install the included VSIX

1. Open VS Code.
2. Open the Command Palette with **Cmd+Shift+P** on macOS or **Ctrl+Shift+P** on Windows/Linux.
3. Run **Extensions: Install from VSIX...**.
4. Select `vs-extension/codex-helper-0.1.0.vsix` from this repository.
5. Reload VS Code when prompted.

The equivalent terminal command is:

```sh
cd vs-extension
code --install-extension ./codex-helper-0.1.0.vsix --force
```

If you previously installed the POC, remove its old extension ID first so the two versions do not appear side by side:

```sh
code --uninstall-extension jianminhuang.codex-helper-poc
code --install-extension ./codex-helper-0.1.0.vsix --force
```

## Usage

1. Start `codex` in one or more integrated Terminal tabs.
2. Open a saved file and optionally select some lines.
3. Choose **Send to Codex ✨** from the editor context menu, click its editor-title icon, or run it from the Command Palette.

There is no default keyboard shortcut. Search for **Send to Codex ✨** in **Keyboard Shortcuts** to add one.

### What gets sent

| Selection | Reference |
|---|---|
| None | `src/Foo.ts` |
| Within one line | `src/Foo.ts#L12` |
| Across lines | `src/Foo.ts#L10-L20` |

- The active file is saved before the Reference is sent.
- A path containing whitespace is wrapped in double quotes, with the line range outside the quotes.
- One leading and one trailing space keep the Reference separate from an existing draft.
- No Enter key is sent, so Codex does not run until you submit the input yourself.
- In a single-folder workspace, paths are relative to that folder. Multi-root workspaces use absolute paths so every Broadcast recipient gets a usable identical Reference.

### Which Codex instances receive it

The extension broadcasts once to every Codex instance it detects in the current VS Code window. Plain shells are not recipients. Detection uses:

- VS Code shell-integration command start/end events.
- A process-tree fallback for Codex already running before extension activation or terminals without shell integration.
- `ps` on macOS/Linux and PowerShell CIM on Windows.

Run **Codex Helper: Show Detection State** from the Command Palette to inspect Terminal names, PIDs, and detection sources in the **Codex Helper** output channel.

## Requirements

- VS Code 1.93 or later on desktop, Remote SSH, Dev Container, or WSL.
- Codex CLI.
- A saved local or remote-workspace file. Browser-only virtual workspaces such as `vscode.dev` are not supported.

## Development

```sh
cd vs-extension
npm install
npm run check
code .
```

Press **F5** to open an Extension Development Host with the extension loaded.

The core behavior is tested through three interfaces: Reference construction, Codex terminal detection, and Broadcast delivery. VS Code and operating-system process discovery are adapters around those modules.

## Manual release

1. Update `version` in `package.json` and run `npm install` to update `package-lock.json`.
2. Verify and package:

   ```sh
   cd vs-extension
   npm ci
   npm run check
   npm run package
   ```

3. Install the generated `codex-helper-VERSION.vsix` locally and repeat the Usage checks above.
4. Commit the release version and create a tag named `vscode-vVERSION`.
5. Create a GitHub Release manually and upload the generated VSIX.

Publishing to the VS Code Marketplace is intentionally separate from this manual GitHub Release flow and requires a Marketplace publisher account.

## Uninstall

Open the Extensions view, find **Codex Helper**, and choose **Uninstall**. The command-line equivalent is:

```sh
code --uninstall-extension jianminhuang.codex-helper
```

## Known limitations

- VS Code's `Terminal.sendText` does not acknowledge that the terminal application consumed the input. A missing error means the extension attempted the delivery, not that Codex confirmed receipt.
- Terminal process discovery depends on process information being visible to the VS Code extension host.

Codex Helper is an independent extension and is not affiliated with or endorsed by OpenAI.
