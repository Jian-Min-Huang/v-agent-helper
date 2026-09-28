package tw.jianminhuang.codexhelper.terminal

import com.intellij.openapi.diagnostic.ControlFlowException
import java.util.concurrent.CancellationException

internal fun Exception.rethrowIfControlFlow() {
    if (this is ControlFlowException || this is CancellationException) throw this
}

/** A possible Broadcast recipient, reduced to whether it is a running Codex instance. */
data class CodexInstanceCandidate<T>(
    val instance: T,
    val runningCodex: Boolean,
)

data class CodexDeliveryFailure<T>(
    val instance: T,
    val exception: Exception,
)

data class CodexBroadcastResult<T>(
    val recipientCount: Int,
    val failures: List<CodexDeliveryFailure<T>>,
)

/** Delivers a Reference to every Codex instance in one Broadcast. */
object CodexBroadcast {
    fun <T> send(
        reference: String,
        candidates: List<CodexInstanceCandidate<T>>,
        deliver: (T, String) -> Unit,
    ): CodexBroadcastResult<T> {
        val recipients = candidates.filter { it.runningCodex }
        val failures = mutableListOf<CodexDeliveryFailure<T>>()
        recipients.forEach { candidate ->
            try {
                deliver(candidate.instance, reference)
            } catch (exception: Exception) {
                exception.rethrowIfControlFlow()
                failures += CodexDeliveryFailure(candidate.instance, exception)
            }
        }
        return CodexBroadcastResult(recipients.size, failures)
    }
}
