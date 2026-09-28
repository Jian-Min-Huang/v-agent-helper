package tw.jianminhuang.codexhelper

import tw.jianminhuang.codexhelper.reference.LineRange
import tw.jianminhuang.codexhelper.reference.TextPosition
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class LineRangeTest {
    @Test
    fun `nothing selected gives no line range`() {
        assertNull(LineRange.ofSelection(TextPosition(line = 11, column = 4), TextPosition(line = 11, column = 4)))
    }

    @Test
    fun `selection within one line gives that line`() {
        assertEquals(
            LineRange(first = 12, last = 12),
            LineRange.ofSelection(TextPosition(line = 11, column = 4), TextPosition(line = 11, column = 9)),
        )
    }

    @Test
    fun `selection across several lines gives the first to the last line`() {
        assertEquals(
            LineRange(first = 10, last = 20),
            LineRange.ofSelection(TextPosition(line = 9, column = 2), TextPosition(line = 19, column = 7)),
        )
    }

    @Test
    fun `selection ending at column 0 does not count that line`() {
        assertEquals(
            LineRange(first = 10, last = 20),
            LineRange.ofSelection(TextPosition(line = 9, column = 0), TextPosition(line = 20, column = 0)),
        )
    }

    @Test
    fun `selecting a whole line gives just that line`() {
        assertEquals(
            LineRange(first = 12, last = 12),
            LineRange.ofSelection(TextPosition(line = 11, column = 0), TextPosition(line = 12, column = 0)),
        )
    }
}
