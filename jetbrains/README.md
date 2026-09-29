# Agent Helper

[![CI](https://github.com/Jian-Min-Huang/v-agent-helper/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Jian-Min-Huang/v-agent-helper/actions/workflows/ci.yml)

An IntelliJ IDEA plugin that sends your place in the editor to every [Codex CLI](https://github.com/openai/codex) instance running in the current project's Terminal.
Select some lines, choose **Send to Codex**, and each Codex input gets the same reference, such as `src/Foo.kt#L10-L20`, while you stay in the editor.
It does for Codex what **Send to Claude Code** does in Claude Code's JetBrains plugin.

## Usage

1. Start Codex in the IDE's Terminal: run `codex` in a shell tab, or open it with the Terminal's **AI Agents** button.
2. In the editor, select some lines, or select nothing to send just the file.
3. Choose **Send to Codex** from the editor's right-click menu, or click the OpenAI icon in the toolbar that floats above the selection.

The reference is pasted into every running Codex instance, even when its input already contains an unsent draft. It is not submitted, so nothing runs until you press Enter in Codex.

There's no default shortcut. To add one, search for **Send to Codex** in **Settings › Keymap**.

### What gets sent

| Selection         | Pasted text          |
|-------------------|----------------------|
| None              | `src/Foo.kt`         |
| Within one line   | `src/Foo.kt#L12`     |
| Across lines      | `src/Foo.kt#L10-L20` |

- Line numbers come from the primary caret. A selection that ends at the start of a line doesn't include that line, so selecting lines 10–20 in full gives `#L10-L20`.
- The path is relative to the current IntelliJ project root, or absolute when the file is outside the project. Every recipient receives identical text regardless of its working directory.
- A path containing whitespace is wrapped in double quotes, with the line numbers outside: `"test dir/a.txt"#L3`.
- There's a space before and after the reference, so it doesn't run into text you've already typed.
- There's no `@`. The text is what Codex's own `@` file picker inserts, so the model sees the same thing as when you pick the file yourself.
- The file is saved first, so Codex reads what you see.

### Which Codex instances get it

Send to Codex broadcasts once to every Codex instance in the current IntelliJ project's Terminal. It never sends to a plain shell, a Terminal tab in another IntelliJ project, or an unsupported Classic Terminal session. The Terminal tool window is not activated, its selected tab does not change, and focus remains in the editor.

Delivery is sequential, but its order is not guaranteed. If one delivery fails, the plugin still attempts every other recipient and then reports all failures in one notification. If no Codex instance is running, a notification says so and nothing is sent.

When Powerlevel10k causes IntelliJ's zsh shell integration to be unavailable, the plugin falls back to the terminal's live process tree to detect Codex.

### Where the floating toolbar shows it

IntelliJ only shows the floating code toolbar for some languages.
Send to Codex is in it for Java, Kotlin, XML, YAML, JSON, Properties, Shell Script, CSS, Dockerfile, HTTP Request and SQL. JavaScript, TypeScript, HTML and Markdown have their own toolbars without it, and plain text has none.
The right-click menu works for any local file.

## Requirements

- IntelliJ IDEA 2026.1 or later (build 261+)
- The new Terminal, which is the default. Classic Terminal isn't supported.
- [Codex CLI](https://github.com/openai/codex)

## Known limitations

- The plugin uses the Terminal's `@ApiStatus.Experimental` API, which may change in a future IntelliJ release.

## Install

Open [GitHub Releases](https://github.com/Jian-Min-Huang/v-agent-helper/releases), choose the newest `jetbrains-v$VERSION` release, and download its plugin ZIP. Then go to **Settings › Plugins › ⚙ › Install Plugin from Disk…** and choose the downloaded ZIP.

To build the plugin from source instead:

```sh
./gradlew buildPlugin
```

Install the ZIP from `build/distributions/` using the same **Install Plugin from Disk…** action.

## Development

You need JDK 21.

```sh
./gradlew test          # unit tests
./gradlew runIde        # start a sandbox IDE with the plugin installed
./gradlew verifyPlugin  # check compatibility with the target IDE
```

CI runs `./gradlew --no-daemon test verifyPlugin buildPlugin` for every pull request and every push to `main` on Eclipse Temurin 21. It validates the installable ZIP and retains it as a workflow artifact. After the first successful run, maintainers should make the **Plugin verification** result a required status check for `main` in the repository's branch protection settings.

### Publishing a release

1. Set `pluginVersion` in `gradle.properties` to the version being released, merge the change to `main`, and update your local `main` branch.
2. Create an annotated tag at that commit and push it:

   ```sh
   git tag -a jetbrains-v$MAJOR.$MINOR.$PATCH -m "jetbrains-v$MAJOR.$MINOR.$PATCH"
   git push origin jetbrains-v$MAJOR.$MINOR.$PATCH
   ```

The **Release JetBrains** workflow validates the existing tag, reruns the complete plugin verification gate, and publishes its versioned ZIP to GitHub Releases. It never creates, moves, or pushes a tag.

If publication is interrupted, open the repository's **Actions › Release JetBrains › Run workflow** page and enter the same existing tag. A rerun keeps an existing Release and replaces only the same-named plugin ZIP.

- [`docs/2026-09-26-send-to-codex-design.md`](docs/2026-09-26-send-to-codex-design.md): design, manual checks and known risks (in Traditional Chinese)
- [`CONTEXT.md`](CONTEXT.md): glossary

---

Agent Helper is an independent plugin and isn't affiliated with or endorsed by OpenAI. The action's icon is OpenAI's logo, used to identify Codex.
