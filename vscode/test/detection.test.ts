import assert from "node:assert/strict";
import test from "node:test";
import {
  detectClaudeCodeTerminals,
  detectCodexTerminals,
} from "../src/core/detection";

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

test("only Claude Code terminals are returned when detecting active shell commands", () => {
  const result = detectClaudeCodeTerminals({
    terminals: [
      { terminal: "Claude", activeCommand: "/opt/homebrew/bin/claude --model sonnet", rootPid: 100 },
      { terminal: "Codex", activeCommand: "/opt/homebrew/bin/codex --model x", rootPid: 200 },
      { terminal: "shell", activeCommand: "git status", rootPid: 300 },
    ],
    processes: [],
  });

  assert.deepEqual(result, [
    { terminal: "Claude", sources: ["shell integration"] },
  ]);
});

test("an npx invocation of the Claude Code package is detected", () => {
  const result = detectClaudeCodeTerminals({
    terminals: [
      { terminal: "npx Claude", activeCommand: "npx @anthropic-ai/claude-code@latest" },
    ],
    processes: [],
  });

  assert.deepEqual(result, [
    { terminal: "npx Claude", sources: ["shell integration"] },
  ]);
});

test("a Node process running the installed Claude Code package is detected", () => {
  const result = detectClaudeCodeTerminals({
    terminals: [{ terminal: "npm Claude", rootPid: 700 }],
    processes: [
      { pid: 700, parentPid: 1, command: "zsh" },
      {
        pid: 701,
        parentPid: 700,
        command: "node /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
      },
    ],
  });

  assert.deepEqual(result, [
    { terminal: "npm Claude", sources: ["process tree"] },
  ]);
});

test("a Windows claude.cmd executable is detected", () => {
  const result = detectClaudeCodeTerminals({
    terminals: [
      { terminal: "Claude on Windows", activeCommand: "C:\\tools\\claude.cmd --model sonnet" },
    ],
    processes: [],
  });

  assert.deepEqual(result, [
    { terminal: "Claude on Windows", sources: ["shell integration"] },
  ]);
});
