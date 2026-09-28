import assert from "node:assert/strict";
import test from "node:test";
import { sendReference } from "../src/core/sendReference";

test("one Broadcast sends the same unsubmitted Reference to every Codex instance", async () => {
  const received: Array<{ terminal: string; text: string }> = [];

  const result = await sendReference(
    {
      filePath: "/repo/src/Foo.ts",
      workspaceRoots: ["/repo"],
      selection: {
        start: { line: 9, character: 2 },
        end: { line: 19, character: 4 },
      },
    },
    "codex",
    {
      save: async () => true,
      recipients: async () => ["first Codex", "second Codex"],
      send: (terminal, text) => received.push({ terminal, text }),
    },
  );

  assert.deepEqual(
    { result, received },
    {
      result: {
        status: "sent",
        reference: " src/Foo.ts#L10-L20 ",
        recipientCount: 2,
        failures: [],
      },
      received: [
        { terminal: "first Codex", text: " src/Foo.ts#L10-L20 " },
        { terminal: "second Codex", text: " src/Foo.ts#L10-L20 " },
      ],
    },
  );
});

test("a Reference is not sent when the active document cannot be saved", async () => {
  const received: string[] = [];

  const result = await sendReference(
    { filePath: "/repo/src/Foo.ts", workspaceRoots: ["/repo"] },
    "codex",
    {
      save: async () => false,
      recipients: async () => ["Codex"],
      send: (_terminal, text) => received.push(text),
    },
  );

  assert.deepEqual({ result, received }, { result: { status: "save-failed" }, received: [] });
});

test("a Broadcast reports when no Codex instance is running", async () => {
  const result = await sendReference(
    { filePath: "/repo/src/Foo.ts", workspaceRoots: ["/repo"] },
    "codex",
    {
      save: async () => true,
      recipients: async () => [],
      send: () => assert.fail("a Broadcast without recipients must not send"),
    },
  );

  assert.deepEqual(result, { status: "no-recipients", reference: " src/Foo.ts " });
});

test("a failed delivery does not prevent later Codex instances from receiving the Reference", async () => {
  const failure = new Error("input unavailable");
  const received: string[] = [];

  const result = await sendReference(
    { filePath: "/repo/src/Foo.ts", workspaceRoots: ["/repo"] },
    "codex",
    {
      save: async () => true,
      recipients: async () => ["first", "broken", "last"],
      send: terminal => {
        received.push(terminal);
        if (terminal === "broken") {
          throw failure;
        }
      },
    },
  );

  assert.deepEqual(
    { result, received },
    {
      result: {
        status: "sent",
        reference: " src/Foo.ts ",
        recipientCount: 3,
        failures: [{ recipient: "broken", error: failure }],
      },
      received: ["first", "broken", "last"],
    },
  );
});

test("a Claude Code Broadcast sends an at-prefixed Reference", async () => {
  const received: string[] = [];

  const result = await sendReference(
    {
      filePath: "/repo/jetbrains/README.md",
      workspaceRoots: ["/repo"],
      selection: {
        start: { line: 75, character: 0 },
        end: { line: 77, character: 0 },
      },
    },
    "claude-code",
    {
      save: async () => true,
      recipients: async () => ["Claude Code"],
      send: (_terminal, text) => received.push(text),
    },
  );

  assert.deepEqual(
    { result, received },
    {
      result: {
        status: "sent",
        reference: " @jetbrains/README.md#L76-L77 ",
        recipientCount: 1,
        failures: [],
      },
      received: [" @jetbrains/README.md#L76-L77 "],
    },
  );
});
