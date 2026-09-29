# Agent Helper for VS Code

Agent Helper sends the active editor file and selected line range to supported coding agents running in the current VS Code window's integrated Terminal. Codex CLI and Claude Code are supported.

Select some lines and choose **Send to Codex ⌨️** or **Send to Claude Code ⌨️**. Each matching agent input receives an agent-specific Reference, such as `src/Foo.ts#L10-L20` for Codex or `@src/Foo.ts#L10-L20` for Claude Code. The text is inserted but not submitted, and focus stays in the editor.

## Local installation

### Install a released VSIX

1. Open [GitHub Releases](https://github.com/Jian-Min-Huang/v-agent-helper/releases), choose the newest `vscode-vVERSION` release, and download its `agent-helper-VERSION.vsix` file.
2. Open VS Code.
3. Open the Command Palette with **Cmd+Shift+P** on macOS or **Ctrl+Shift+P** on Windows/Linux.
4. Run **Extensions: Install from VSIX...** and select the downloaded file.
5. Reload VS Code when prompted.

The equivalent terminal command is:

```sh
code --install-extension ./agent-helper-VERSION.vsix --force
```

If you previously installed the POC, remove its old extension ID first so the two versions do not appear side by side:

```sh
code --uninstall-extension jianminhuang.codex-helper-poc
code --install-extension ./agent-helper-VERSION.vsix --force
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

### herdr

When an integrated Terminal runs a [herdr](https://herdr.dev) client (`herdr`, `herdr --session NAME`, or `herdr session attach NAME`), the agents live under the herdr server rather than under that Terminal, so Agent Helper asks the attached session directly:

- `herdr agent list` finds the Codex (`codex`) and Claude Code (`claude`) panes in that session.
- Only herdr agents whose working directory is inside one of this window's workspace folders receive the Reference, so several VS Code windows can share one herdr session without sending to each other's agents. With no folder open, every matching herdr agent receives it.
- `herdr pane send-text` inserts the Reference into each pane directly, whichever herdr pane is focused. No Enter key is sent.

The `herdr` executable must be on the `PATH` seen by VS Code, or the client must have been started with an absolute path. Remote attachments (`--remote`, `--machine`) are not supported.

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

## Publishing a release

1. Update `version` in `package.json` and run `npm install` to update `package-lock.json`.
2. Verify and package:

   ```sh
   cd vscode
   npm ci
   npm run check
   npm run package
   ```

3. Install the generated `agent-helper-VERSION.vsix` locally and repeat the Usage checks above.
4. Commit the release version, merge it to `main`, then create and push an annotated tag:

   ```sh
   git tag -a vscode-vMAJOR.MINOR.PATCH -m "vscode-vMAJOR.MINOR.PATCH"
   git push origin vscode-vMAJOR.MINOR.PATCH
   ```

The **Release VS Code** workflow validates that the tag matches `package.json`, reruns the verification gate, and publishes the VSIX to GitHub Releases. It never publishes to the VS Code Marketplace or creates, moves, or pushes a tag.

If publication is interrupted, open the repository's **Actions › Release VS Code › Run workflow** page and enter the same existing tag. A rerun keeps an existing Release and replaces only the same-named VSIX.

Publishing to the VS Code Marketplace remains intentionally unsupported by this workflow.

## Uninstall

Open the Extensions view, find **Agent Helper**, and choose **Uninstall**. The command-line equivalent is:

```sh
code --uninstall-extension jianminhuang.agent-helper
```

## Known limitations

- VS Code's `Terminal.sendText` does not acknowledge that the terminal application consumed the input. A missing error means the extension attempted the delivery, not that the agent confirmed receipt.
- Terminal process discovery depends on process information being visible to the VS Code extension host.
- herdr agents started outside the workspace folder, for example in a parent directory, are listed in **Show Detection State** as outside the workspace and do not receive the Reference.

Agent Helper is an independent extension and is not affiliated with or endorsed by OpenAI or Anthropic.
