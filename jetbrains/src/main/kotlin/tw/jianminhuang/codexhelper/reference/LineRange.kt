package tw.jianminhuang.codexhelper.reference

/** A 0-based line and column in a document, as the editor counts them. */
data class TextPosition(val line: Int, val column: Int)

/** A 1-based, inclusive range of lines, as Codex reads them in `#L10-L20`. */
data class LineRange(val first: Int, val last: Int) {
    companion object {
        /**
         * The lines a selection from [start] to [end] covers; null when nothing is selected.
         * A selection ending at column 0 doesn't count that line, so selecting whole lines gives just those lines.
         */
        fun ofSelection(start: TextPosition, end: TextPosition): LineRange? {
            if (start == end) return null
            val lastLine = if (end.column == 0) end.line - 1 else end.line
            return LineRange(start.line + 1, lastLine + 1)
        }
    }
}
