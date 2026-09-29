package tw.jianminhuang.agenthelper

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.vfs.VirtualFile
import tw.jianminhuang.agenthelper.reference.LineRange
import tw.jianminhuang.agenthelper.reference.TextPosition
import tw.jianminhuang.agenthelper.service.CodexTerminalSender

class SendToCodexAction : DumbAwareAction() {
    /** 在背景執行緒執行頻繁的可用性檢查，以便安全讀取 Editor 與 VirtualFile 資料。 */
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    /**
     * 只有在專案已開啟，而且目前 Editor 對應到本機檔案時，才顯示並啟用這個 Action；
     * 查看 JAR 內的 class 等非本機檔案時不顯示。
     */
    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = e.project != null && editor != null && localFileIn(editor) != null
    }

    /** 儲存目前文件、取得主游標選取的行號範圍，再交給 project service 傳送。 */
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val file = localFileIn(editor) ?: return
        FileDocumentManager.getInstance().saveDocument(editor.document)
        project.service<CodexTerminalSender>().send(file.path, selectedLines(editor))
    }

    private fun selectedLines(editor: Editor): LineRange? =
        run {
            val caret = editor.caretModel.primaryCaret
            val document = editor.document
            fun positionOf(offset: Int): TextPosition {
                val line = document.getLineNumber(offset)
                return TextPosition(line, offset - document.getLineStartOffset(line))
            }
            return LineRange.ofSelection(positionOf(caret.selectionStart), positionOf(caret.selectionEnd))
        }

    private fun localFileIn(editor: Editor): VirtualFile? =
        FileDocumentManager
            .getInstance()
            .getFile(editor.document)
            ?.takeIf { it.isInLocalFileSystem }
}
