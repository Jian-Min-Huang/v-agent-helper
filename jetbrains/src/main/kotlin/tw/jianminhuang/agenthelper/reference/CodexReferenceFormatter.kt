package tw.jianminhuang.agenthelper.reference

/**
 * Builds the ` path ` or ` path#L10-L20 ` text pasted into Codex's input box, written the way Codex's own
 * `@` file picker writes a path: no `@`, which only opens the picker. The leading space keeps the path from
 * joining text already typed; Codex trims it before sending.
 */
object CodexReferenceFormatter {
    fun format(filePath: String, projectRoot: String?, lineRange: LineRange? = null): String =
        " ${quoted(referencePath(filePath, projectRoot))}${lineSuffix(lineRange)} "

    private fun lineSuffix(lineRange: LineRange?): String = when {
        lineRange == null -> ""
        lineRange.first == lineRange.last -> "#L${lineRange.first}"
        else -> "#L${lineRange.first}-L${lineRange.last}"
    }

    /** Like Codex's picker: wrapped in double quotes when it has whitespace, unless it already has a `"`. */
    private fun quoted(path: String): String =
        if (path.any(Char::isWhitespace) && '"' !in path) "\"$path\"" else path

    /** Relative to [projectRoot] when the file is under it, absolute otherwise; always `/`-separated. */
    private fun referencePath(filePath: String, projectRoot: String?): String {
        val file = filePath.replace('\\', '/')
        if (projectRoot == null) return file
        val base = projectRoot.replace('\\', '/').trimEnd('/') + "/"
        return if (file.startsWith(base)) file.removePrefix(base) else file
    }
}
