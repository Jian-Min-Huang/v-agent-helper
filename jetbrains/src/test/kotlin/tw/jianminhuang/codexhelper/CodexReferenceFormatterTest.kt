package tw.jianminhuang.codexhelper

import tw.jianminhuang.codexhelper.reference.CodexReferenceFormatter
import tw.jianminhuang.codexhelper.reference.LineRange
import kotlin.test.Test
import kotlin.test.assertEquals

class CodexReferenceFormatterTest {
    @Test
    fun `file under the project root is referenced by its relative path`() {
        assertEquals(" src/Foo.kt ", CodexReferenceFormatter.format("/repo/src/Foo.kt", "/repo"))
    }

    @Test
    fun `file outside the project root is referenced by its absolute path`() {
        assertEquals(" /other/Bar.kt ", CodexReferenceFormatter.format("/other/Bar.kt", "/repo"))
    }

    @Test
    fun `file is referenced by its absolute path when there is no project root`() {
        assertEquals(" /repo/src/Foo.kt ", CodexReferenceFormatter.format("/repo/src/Foo.kt", null))
    }

    @Test
    fun `file in a sibling directory that shares the project root's name prefix is outside it`() {
        assertEquals(" /repo-docs/Bar.kt ", CodexReferenceFormatter.format("/repo-docs/Bar.kt", "/repo"))
    }

    @Test
    fun `relative path uses forward slashes when the paths use backslashes`() {
        assertEquals(" src/main/Foo.kt ", CodexReferenceFormatter.format("C:\\repo\\src\\main\\Foo.kt", "C:\\repo"))
    }

    @Test
    fun `project root with a trailing separator still gives a relative path`() {
        assertEquals(" src/Foo.kt ", CodexReferenceFormatter.format("/repo/src/Foo.kt", "/repo/"))
    }

    @Test
    fun `a one-line range is appended to the reference as that line`() {
        assertEquals(
            " src/Foo.kt#L12 ",
            CodexReferenceFormatter.format("/repo/src/Foo.kt", "/repo", LineRange(first = 12, last = 12)),
        )
    }

    @Test
    fun `a range of several lines is appended to the reference as first to last`() {
        assertEquals(
            " src/Foo.kt#L10-L20 ",
            CodexReferenceFormatter.format("/repo/src/Foo.kt", "/repo", LineRange(first = 10, last = 20)),
        )
    }

    @Test
    fun `a path with whitespace is quoted, with the line range outside the quotes`() {
        assertEquals(
            " \"My Docs/Foo Bar.kt\"#L3 ",
            CodexReferenceFormatter.format("/repo/My Docs/Foo Bar.kt", "/repo", LineRange(first = 3, last = 3)),
        )
    }

    @Test
    fun `a path with whitespace and a double quote is not quoted`() {
        assertEquals(" My \"x\" Docs/Foo.kt ", CodexReferenceFormatter.format("/repo/My \"x\" Docs/Foo.kt", "/repo"))
    }
}
