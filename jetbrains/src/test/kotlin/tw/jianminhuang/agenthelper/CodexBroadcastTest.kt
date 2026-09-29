package tw.jianminhuang.agenthelper

import tw.jianminhuang.agenthelper.terminal.CodexBroadcast
import tw.jianminhuang.agenthelper.terminal.CodexInstanceCandidate
import java.util.concurrent.CancellationException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class CodexBroadcastTest {
    private fun instance(name: String, runningCodex: Boolean = false) =
        CodexInstanceCandidate(instance = name, runningCodex = runningCodex)

    @Test
    fun `broadcast delivers exactly once to every running Codex instance`() {
        val deliveries = mutableListOf<String>()
        val candidates = listOf(
            instance("first Codex", runningCodex = true),
            instance("plain shell"),
            instance("second Codex", runningCodex = true),
        )

        val result = CodexBroadcast.send(" Reference ", candidates) { recipient, _ -> deliveries += recipient }

        assertEquals(listOf("first Codex", "second Codex"), deliveries)
        assertEquals(emptyList(), result.failures)
    }

    @Test
    fun `broadcast attempts later instances and reports a delivery failure`() {
        val failure = IllegalStateException("input unavailable")
        val deliveries = mutableListOf<String>()
        val candidates = listOf(
            instance("first Codex", runningCodex = true),
            instance("broken Codex", runningCodex = true),
            instance("last Codex", runningCodex = true),
        )

        val result = CodexBroadcast.send(" Reference ", candidates) { recipient, _ ->
            deliveries += recipient
            if (recipient == "broken Codex") throw failure
        }

        assertEquals(listOf("first Codex", "broken Codex", "last Codex"), deliveries)
        assertEquals(listOf("broken Codex"), result.failures.map { it.instance })
        assertSame(failure, result.failures.single().exception)
    }

    @Test
    fun `broadcast does not turn cancellation into a delivery failure`() {
        val candidates = listOf(instance("Codex", runningCodex = true))

        assertFailsWith<CancellationException> {
            CodexBroadcast.send(" Reference ", candidates) { _, _ -> throw CancellationException("cancelled") }
        }
    }

    @Test
    fun `broadcast reports that it has no recipients when no Codex instance is running`() {
        val candidates = listOf(instance("plain shell"))

        val result = CodexBroadcast.send(" Reference ", candidates) { _, _ ->
            error("plain shell must not receive a Reference")
        }

        assertEquals(0, result.recipientCount)
    }

    @Test
    fun `broadcast delivers the same project-relative Reference to every recipient`() {
        val deliveries = mutableListOf<Pair<String, String>>()
        val candidates = listOf(
            instance("Codex in project root", runningCodex = true),
            instance("Codex in subdirectory", runningCodex = true),
        )

        CodexBroadcast.send(
            reference = " src/Foo.kt#L10-L20 ",
            candidates = candidates,
        ) { recipient, reference -> deliveries += recipient to reference }

        assertEquals(
            listOf(
                "Codex in project root" to " src/Foo.kt#L10-L20 ",
                "Codex in subdirectory" to " src/Foo.kt#L10-L20 ",
            ),
            deliveries,
        )
    }
}
