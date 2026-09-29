package tw.jianminhuang.agenthelper

import tw.jianminhuang.agenthelper.terminal.TerminalTabState
import tw.jianminhuang.agenthelper.terminal.isRunningCodex
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TerminalTabStateTest {
    private val shellTab = TerminalTabState(
        sessionRunning = true,
        directCommand = null,
        activeShellCommand = null,
        activeShellCommandExited = false,
    )

    @Test
    fun `shell tab whose active command is codex is running codex`() {
        assertTrue(shellTab.copy(activeShellCommand = "codex").isRunningCodex())
    }

    @Test
    fun `shell tab without shell integration whose process tree contains codex is running codex`() {
        assertTrue(shellTab.copy(processCommands = listOf("/opt/homebrew/bin/codex")).isRunningCodex())
    }

    @Test
    fun `shell tab whose codex command has exited is not running codex`() {
        assertFalse(shellTab.copy(activeShellCommand = "codex", activeShellCommandExited = true).isRunningCodex())
    }

    @Test
    fun `shell tab at the prompt is not running codex`() {
        assertFalse(shellTab.isRunningCodex())
    }

    @Test
    fun `tab the AI Agents button started as codex is running codex`() {
        assertTrue(shellTab.copy(directCommand = "/opt/homebrew/bin/codex").isRunningCodex())
    }

    @Test
    fun `tab started as codex whose session has ended is not running codex`() {
        assertFalse(shellTab.copy(directCommand = "/opt/homebrew/bin/codex", sessionRunning = false).isRunningCodex())
    }

    @Test
    fun `tab started as another agent is not running codex`() {
        assertFalse(shellTab.copy(directCommand = "/opt/homebrew/bin/claude").isRunningCodex())
    }
}
