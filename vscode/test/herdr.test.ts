import assert from "node:assert/strict";
import test from "node:test";
import {
  findHerdrSessions,
  matchHerdrAgent,
  parseHerdrAgentList,
  type HerdrAgent,
} from "../src/core/herdr";

test("a herdr client running in a terminal attaches that terminal to the default herdr session", () => {
  const sessions = findHerdrSessions({
    terminals: [
      { terminal: "herdr", rootPid: 100 },
      { terminal: "shell", rootPid: 200 },
    ],
    processes: [
      { pid: 100, parentPid: 1, command: "/bin/zsh" },
      { pid: 101, parentPid: 100, command: "herdr" },
      { pid: 200, parentPid: 1, command: "/bin/zsh" },
      { pid: 300, parentPid: 1, command: "/opt/homebrew/bin/herdr server" },
    ],
  });

  assert.deepEqual(sessions, [{ executable: "herdr" }]);
});

test("named herdr sessions are read from --session and session attach", () => {
  const sessions = findHerdrSessions({
    terminals: [
      { terminal: "flag", rootPid: 100 },
      { terminal: "flag with equals", rootPid: 200 },
      { terminal: "attach", rootPid: 300 },
    ],
    processes: [
      { pid: 100, parentPid: 1, command: "zsh" },
      { pid: 101, parentPid: 100, command: "/opt/homebrew/bin/herdr --session work" },
      { pid: 200, parentPid: 1, command: "zsh" },
      { pid: 201, parentPid: 200, command: "herdr --session=play" },
      { pid: 300, parentPid: 1, command: "zsh" },
      { pid: 301, parentPid: 300, command: "herdr session attach review" },
    ],
  });

  assert.deepEqual(sessions, [
    { executable: "/opt/homebrew/bin/herdr", name: "work" },
    { executable: "herdr", name: "play" },
    { executable: "herdr", name: "review" },
  ]);
});

test("terminals attached to the same herdr session yield one session", () => {
  const sessions = findHerdrSessions({
    terminals: [
      { terminal: "first", rootPid: 100 },
      { terminal: "second", rootPid: 200 },
      { terminal: "explicit default", rootPid: 300 },
    ],
    processes: [
      { pid: 100, parentPid: 1, command: "zsh" },
      { pid: 101, parentPid: 100, command: "herdr" },
      { pid: 200, parentPid: 1, command: "zsh" },
      { pid: 201, parentPid: 200, command: "herdr" },
      { pid: 300, parentPid: 1, command: "zsh" },
      { pid: 301, parentPid: 300, command: "herdr --session default" },
    ],
  });

  assert.deepEqual(sessions, [{ executable: "herdr" }]);
});

test("herdr API commands and remote attachments are not local herdr clients", () => {
  const sessions = findHerdrSessions({
    terminals: [{ terminal: "shell", rootPid: 100 }],
    processes: [
      { pid: 100, parentPid: 1, command: "zsh" },
      { pid: 101, parentPid: 100, command: "herdr agent list" },
      { pid: 102, parentPid: 100, command: "herdr --remote dev-box" },
      { pid: 103, parentPid: 100, command: "herdr --machine dev-box agent list" },
      { pid: 104, parentPid: 100, command: "herdr server" },
    ],
  });

  assert.deepEqual(sessions, []);
});

test("herdr agent list output becomes pane-addressable agents", () => {
  const stdout = JSON.stringify({
    id: "cli:agent:list",
    result: {
      type: "agent_list",
      agents: [
        {
          agent: "codex",
          cwd: "/repo",
          foreground_cwd: "/repo/app",
          pane_id: "w2:p1",
          terminal_title_stripped: "Codex task",
        },
        { agent: "claude", cwd: "/repo", pane_id: "w2:p2" },
        { agent: "codex" },
      ],
    },
  });

  assert.deepEqual(parseHerdrAgentList(stdout), [
    { kind: "codex", paneId: "w2:p1", cwd: "/repo/app", title: "Codex task" },
    { kind: "claude", paneId: "w2:p2", cwd: "/repo" },
  ]);
});

test("only herdr agents of the requested type inside a workspace folder are recipients", () => {
  const agents: HerdrAgent[] = [
    { kind: "codex", paneId: "w1:p1", cwd: "/repo" },
    { kind: "codex", paneId: "w1:p2", cwd: "/repo/packages/app" },
    { kind: "codex", paneId: "w1:p3", cwd: "/repo-other" },
    { kind: "codex", paneId: "w1:p4", cwd: "/elsewhere" },
    { kind: "codex", paneId: "w1:p5" },
    { kind: "claude", paneId: "w1:p6", cwd: "/repo" },
  ];

  assert.deepEqual(agents.map(agent => matchHerdrAgent("codex", agent, ["/repo/"])), [
    "recipient",
    "recipient",
    "outside workspace",
    "outside workspace",
    "outside workspace",
    "other agent",
  ]);
  assert.deepEqual(agents.map(agent => matchHerdrAgent("claude-code", agent, ["/repo"])), [
    "other agent",
    "other agent",
    "other agent",
    "other agent",
    "other agent",
    "recipient",
  ]);
});

test("Windows herdr agent folders match workspace folders case-insensitively", () => {
  assert.equal(
    matchHerdrAgent("codex", { kind: "codex", paneId: "w1:p1", cwd: "c:\\Repo\\src" }, ["C:\\repo"]),
    "recipient",
  );
});

test("every herdr agent of the requested type is a recipient when no folder is open", () => {
  const agents: HerdrAgent[] = [
    { kind: "codex", paneId: "w1:p1", cwd: "/anywhere" },
    { kind: "codex", paneId: "w1:p2" },
    { kind: "claude", paneId: "w1:p3", cwd: "/anywhere" },
  ];

  assert.deepEqual(agents.map(agent => matchHerdrAgent("codex", agent, [])), [
    "recipient",
    "recipient",
    "other agent",
  ]);
});
