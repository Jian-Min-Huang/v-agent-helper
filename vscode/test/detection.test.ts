import assert from "node:assert/strict";
import test from "node:test";
import { detectCodexTerminals } from "../src/core/detection";

test("only a terminal whose active shell command is Codex becomes a Broadcast recipient", () => {
  const result = detectCodexTerminals({
    terminals: [
      { terminal: "Codex", activeCommand: "/opt/homebrew/bin/codex --model x", rootPid: 100 },
      { terminal: "shell", activeCommand: "git status", rootPid: 200 },
    ],
    processes: [],
  });

  assert.deepEqual(result, [
    { terminal: "Codex", sources: ["shell integration"] },
  ]);
});

test("a Windows terminal whose descendant process is codex.exe becomes a Broadcast recipient", () => {
  const result = detectCodexTerminals({
    terminals: [
      { terminal: "Codex on Windows", rootPid: 400 },
      { terminal: "PowerShell", rootPid: 500 },
    ],
    processes: [
      { pid: 400, parentPid: 1, command: "powershell.exe" },
      { pid: 401, parentPid: 400, command: "C:\\tools\\codex.exe --model x" },
      { pid: 500, parentPid: 1, command: "powershell.exe" },
    ],
  });

  assert.deepEqual(result, [
    { terminal: "Codex on Windows", sources: ["process tree"] },
  ]);
});

test("a Node process running the installed @openai/codex package is detected", () => {
  const result = detectCodexTerminals({
    terminals: [{ terminal: "npm Codex", rootPid: 600 }],
    processes: [
      { pid: 600, parentPid: 1, command: "powershell.exe" },
      {
        pid: 601,
        parentPid: 600,
        command: "node.exe C:\\Users\\me\\node_modules\\@openai\\codex\\bin\\codex.js",
      },
    ],
  });

  assert.deepEqual(result, [
    { terminal: "npm Codex", sources: ["process tree"] },
  ]);
});

test("a quoted Windows codex.exe path containing whitespace is detected", () => {
  const result = detectCodexTerminals({
    terminals: [
      { terminal: "quoted Codex", activeCommand: "\"C:\\Program Files\\Codex\\codex.exe\" --model x" },
    ],
    processes: [],
  });

  assert.deepEqual(result, [
    { terminal: "quoted Codex", sources: ["shell integration"] },
  ]);
});
