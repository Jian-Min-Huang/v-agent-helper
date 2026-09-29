package tw.jianminhuang.agenthelper

import tw.jianminhuang.agenthelper.terminal.terminalProcessCommands
import kotlin.test.Test
import kotlin.test.assertTrue

class TerminalProcessTreeTest {
    @Test
    fun `reads the command of a live process`() {
        val process = ProcessBuilder("/bin/sleep", "30").start()
        try {
            assertTrue(terminalProcessCommands(process.pid()).any(::isSleepCommand))
        } finally {
            process.destroyForcibly()
            process.waitFor()
        }
    }

    @Test
    fun `reads commands of live descendants`() {
        val process = ProcessBuilder("/bin/sh", "-c", "sleep 30 & wait").start()
        try {
            assertTrue(waitUntil { terminalProcessCommands(process.pid()).any(::isSleepCommand) })
        } finally {
            val descendants = process.toHandle().descendants()
            try {
                descendants.forEach { it.destroyForcibly() }
            } finally {
                descendants.close()
            }
            process.destroyForcibly()
            process.waitFor()
        }
    }

    @Test
    fun `missing process has no commands`() {
        assertTrue(terminalProcessCommands(Long.MAX_VALUE).isEmpty())
    }

    private fun waitUntil(condition: () -> Boolean): Boolean {
        repeat(40) {
            if (condition()) return true
            Thread.sleep(25)
        }
        return false
    }

    private fun isSleepCommand(command: String): Boolean =
        command.substringBefore(' ').substringAfterLast('/') == "sleep"
}
