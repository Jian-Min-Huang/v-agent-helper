package tw.jianminhuang.codexhelper.service

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.text.StringUtil
import com.intellij.terminal.frontend.toolwindow.TerminalToolWindowTab
import com.intellij.terminal.frontend.toolwindow.TerminalToolWindowTabsManager
import com.intellij.terminal.frontend.view.TerminalViewSessionState
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import org.jetbrains.plugins.terminal.startup.TerminalProcessType
import org.jetbrains.plugins.terminal.view.shellIntegration.TerminalCommandBlock
import tw.jianminhuang.codexhelper.terminal.CodexBroadcast
import tw.jianminhuang.codexhelper.terminal.CodexInstanceCandidate
import tw.jianminhuang.codexhelper.terminal.TerminalTabState
import tw.jianminhuang.codexhelper.terminal.isRunningCodex
import tw.jianminhuang.codexhelper.reference.CodexReferenceFormatter
import tw.jianminhuang.codexhelper.reference.LineRange
import tw.jianminhuang.codexhelper.terminal.rethrowIfControlFlow
import tw.jianminhuang.codexhelper.terminal.terminalProcessCommands

private const val NOTIFICATION_GROUP_ID = "Codex Helper"
private const val CODEX_NOT_FOUND_MESSAGE = "找不到正在執行的 Codex，請先在 Terminal 執行 codex"
private const val SEND_FAILED_TITLE = "Send to Codex 失敗"

private val log = logger<CodexTerminalSender>()

/** Broadcasts one project-relative Reference to every Codex instance in this project. */
@Service(Service.Level.PROJECT)
class CodexTerminalSender(private val project: Project) {
    fun send(filePath: String, lineRange: LineRange?) {
        try {
            broadcast(filePath, lineRange)
        } catch (e: Exception) {
            e.rethrowIfControlFlow()
            log.warn("Send to Codex failed", e)
            notifyError(SEND_FAILED_TITLE, StringUtil.escapeXmlEntities(e.message ?: e.javaClass.name))
        }
    }

    private fun broadcast(filePath: String, lineRange: LineRange?) {
        val reference = CodexReferenceFormatter.format(filePath, project.basePath, lineRange)
        val candidates = TerminalToolWindowTabsManager.getInstance(project).tabs.map { tab ->
            CodexInstanceCandidate(instance = tab, runningCodex = stateOf(tab).isRunningCodex())
        }
        val result = CodexBroadcast.send(reference, candidates) { tab, text ->
            tab.view.createSendTextBuilder()
                .useBracketedPasteMode()
                .send(text)
        }

        if (result.recipientCount == 0) {
            notifyWarning(CODEX_NOT_FOUND_MESSAGE)
            return
        }
        if (result.failures.isNotEmpty()) {
            result.failures.forEach { failure ->
                log.warn("Send to Codex failed for a Broadcast recipient", failure.exception)
            }
            val details = result.failures
                .map { StringUtil.escapeXmlEntities(it.exception.message ?: it.exception.javaClass.name) }
                .distinct()
                .joinToString("<br>")
            notifyError(
                SEND_FAILED_TITLE,
                "${result.failures.size} 個 Codex 實例傳送失敗" + if (details.isEmpty()) "" else "<br>$details",
            )
        }
    }

    private fun stateOf(tab: TerminalToolWindowTab): TerminalTabState {
        val view = tab.view
        val startupOptions = view.startupOptionsDeferred.completedOrNull()
        val shellIntegration = view.shellIntegrationDeferred.completedOrNull()
        // The Terminal's AI Agents button starts codex as the tab's own process, with no shell around it.
        val directCommand = startupOptions
            ?.takeIf { it.processType == TerminalProcessType.NON_SHELL }
            ?.shellCommand?.joinToString(" ")
        val block = shellIntegration?.blocksModel?.activeBlock as? TerminalCommandBlock
        return TerminalTabState(
            sessionRunning = view.sessionState.value == TerminalViewSessionState.Running,
            directCommand = directCommand,
            activeShellCommand = block?.executedCommand,
            activeShellCommandExited = block?.exitCode != null,
            // Powerlevel10k prevents IntelliJ's zsh integration from initializing. In that case the
            // terminal process tree is the remaining source that can distinguish codex from a plain shell.
            processCommands = if (startupOptions?.processType == TerminalProcessType.SHELL && shellIntegration == null) {
                terminalProcessCommands(startupOptions.pid)
            } else {
                emptyList()
            },
        )
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private fun <T> Deferred<T>.completedOrNull(): T? = if (isCompleted && !isCancelled) getCompleted() else null

    private fun notifyWarning(message: String) {
        notificationGroup().createNotification(message, NotificationType.WARNING).notify(project)
    }

    /** [message] is shown as HTML, so escape any text that comes from outside. */
    private fun notifyError(title: String, message: String) {
        notificationGroup().createNotification(title, message, NotificationType.ERROR).notify(project)
    }

    private fun notificationGroup() = NotificationGroupManager.getInstance().getNotificationGroup(NOTIFICATION_GROUP_ID)
}
