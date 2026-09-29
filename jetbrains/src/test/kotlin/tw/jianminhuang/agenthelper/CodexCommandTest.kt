package tw.jianminhuang.agenthelper

import tw.jianminhuang.agenthelper.terminal.isCodexCommand
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CodexCommandTest {
    @Test
    fun `bare codex is a codex command`() {
        assertTrue(isCodexCommand("codex"))
    }

    @Test
    fun `codex run by its full path with arguments is a codex command`() {
        assertTrue(isCodexCommand("/opt/homebrew/bin/codex --model x"))
    }

    @Test
    fun `codex run by a Windows path is a codex command`() {
        assertTrue(isCodexCommand("C:\\tools\\codex --model x"))
    }

    @Test
    fun `codex run through npx is a codex command`() {
        assertTrue(isCodexCommand("npx @openai/codex"))
    }

    @Test
    fun `codex run through npx at a pinned version is a codex command`() {
        assertTrue(isCodexCommand("npx @openai/codex@0.156.1"))
    }

    @Test
    fun `a program whose name only starts with codex is not a codex command`() {
        assertFalse(isCodexCommand("codexx"))
    }

    @Test
    fun `codex as an argument to another program is not a codex command`() {
        assertFalse(isCodexCommand("echo codex"))
    }

    @Test
    fun `an unrelated command is not a codex command`() {
        assertFalse(isCodexCommand("git status"))
    }
}
