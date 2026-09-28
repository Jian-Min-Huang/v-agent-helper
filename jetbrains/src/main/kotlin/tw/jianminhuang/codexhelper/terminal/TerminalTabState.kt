package tw.jianminhuang.codexhelper.terminal

private const val CODEX_NPM_PACKAGE = "@openai/codex"
private val WHITESPACE = Regex("\\s+")

/** A Terminal tab's state, reduced to what decides whether it is running codex. */
data class TerminalTabState(
    val sessionRunning: Boolean,
    /** The command a tab was started with when its process isn't a shell; null for shell tabs or when not known yet. */
    val directCommand: String?,
    /** The command of the shell's active command block; null when there is none or shell integration isn't ready. */
    val activeShellCommand: String?,
    val activeShellCommandExited: Boolean,
    /** Commands in the terminal process tree, used when shell integration cannot report an active command. */
    val processCommands: List<String> = emptyList(),
)

fun TerminalTabState.isRunningCodex(): Boolean {
    val runningShellCommand = activeShellCommand?.takeUnless { activeShellCommandExited }
    return sessionRunning && (listOfNotNull(directCommand, runningShellCommand) + processCommands)
        .any(::isCodexCommand)
}

fun isCodexCommand(command: String): Boolean {
    val tokens = command.trim().split(WHITESPACE)
    return tokens.first().substringAfterLast('/').substringAfterLast('\\') == "codex" ||
            tokens.any { it == CODEX_NPM_PACKAGE || it.startsWith("$CODEX_NPM_PACKAGE@") }
}
