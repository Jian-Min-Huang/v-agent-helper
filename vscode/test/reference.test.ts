import assert from "node:assert/strict";
import test from "node:test";
import { buildReference } from "../src/core/reference";

test("a file in a single workspace is referenced by its relative path", () => {
  assert.equal(
    buildReference({
      filePath: "/repo/src/Foo.ts",
      workspaceRoots: ["/repo"],
    }, "codex"),
    " src/Foo.ts ",
  );
});

test("a whole-line selection excludes the line at the ending column zero", () => {
  assert.equal(
    buildReference({
      filePath: "/repo/src/Foo.ts",
      workspaceRoots: ["/repo"],
      selection: {
        start: { line: 9, character: 0 },
        end: { line: 20, character: 0 },
      },
    }, "codex"),
    " src/Foo.ts#L10-L20 ",
  );
});

test("a multi-root workspace uses an absolute path shared by every Broadcast recipient", () => {
  assert.equal(
    buildReference({
      filePath: "/work/api/src/Foo.ts",
      workspaceRoots: ["/work/api", "/work/web"],
    }, "codex"),
    " /work/api/src/Foo.ts ",
  );
});

test("a path containing whitespace is quoted before the line suffix", () => {
  assert.equal(
    buildReference({
      filePath: "/repo/My Docs/Foo Bar.ts",
      workspaceRoots: ["/repo"],
      selection: {
        start: { line: 2, character: 1 },
        end: { line: 2, character: 5 },
      },
    }, "codex"),
    " \"My Docs/Foo Bar.ts\"#L3 ",
  );
});

test("Windows workspace containment is case-insensitive and uses forward slashes", () => {
  assert.equal(
    buildReference({
      filePath: "C:\\Repo\\src\\Foo.ts",
      workspaceRoots: ["c:\\repo"],
    }, "codex"),
    " src/Foo.ts ",
  );
});

test("Claude Code prefixes the reference path with an at sign", () => {
  assert.equal(
    buildReference({
      filePath: "/repo/jetbrains/README.md",
      workspaceRoots: ["/repo"],
      selection: {
        start: { line: 75, character: 0 },
        end: { line: 77, character: 0 },
      },
    }, "claude-code"),
    " @jetbrains/README.md#L76-L77 ",
  );
});

test("Claude Code places its at sign before a quoted path", () => {
  assert.equal(
    buildReference({
      filePath: "/repo/My Docs/README.md",
      workspaceRoots: ["/repo"],
    }, "claude-code"),
    " @\"My Docs/README.md\" ",
  );
});
