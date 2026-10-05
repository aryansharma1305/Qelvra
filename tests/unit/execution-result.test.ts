import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ChangedFileSchema,
  ExecutionResultSchema,
  type Execution,
  type Message,
  type Task,
} from "@qelvra/shared";
import { correlatedResult } from "../../apps/server/src/execution/execution-result-handler";
import {
  executionPrompt,
  buildExecutionCommand,
} from "../../apps/server/src/providers/provider-execution";
import { PROVIDER_DEFINITIONS } from "../../apps/server/src/providers/provider-types";
const taskId = `task-${randomUUID()}`,
  id = `exec-${randomUUID()}`,
  requestMessageId = `msg-${randomUUID()}`;
const result = {
  executionId: id,
  requestMessageId,
  taskId,
  agentId: "nova",
  status: "completed" as const,
  summary: "Created hello.txt",
  changedFiles: ["hello.txt"],
  notes: null,
};
const execution: Execution = {
  id,
  taskId,
  agentId: "nova",
  providerId: "fake",
  status: "awaiting_result",
  requestMessageId,
  resultMessageId: null,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  errorCode: null,
  result: null,
};
const task: Task = {
  id: taskId,
  title: "Work",
  description: "",
  assignee: "nova",
  status: "working",
  createdBy: "user",
  createdAt: execution.startedAt,
  updatedAt: execution.startedAt,
};
const message: Message = {
  id: `msg-${randomUUID()}`,
  from: "nova",
  to: "system",
  type: "result",
  body: JSON.stringify(result),
  createdAt: execution.startedAt,
};
describe("structured result boundaries and correlation", () => {
  it("accepts the exact expected result without mutating task state", () => {
    expect(correlatedResult(message, execution, task)).toEqual(result);
    expect(task.status).toBe("working");
  });
  it.each([
    "../etc/passwd",
    "../../etc/passwd",
    "/etc/passwd",
    "C:\\secrets",
    "\\\\server\\file",
    "a/../b",
    "a//b",
    "./a",
    "a\0b",
    "a\nb",
  ])("rejects unsafe changed path %j", (path) => {
    expect(ChangedFileSchema.safeParse(path).success).toBe(false);
  });
  it("enforces byte limits, file count and mailbox total size", () => {
    expect(ExecutionResultSchema.safeParse({ ...result, summary: "é".repeat(4097) }).success).toBe(
      false,
    );
    expect(ExecutionResultSchema.safeParse({ ...result, notes: "x".repeat(16385) }).success).toBe(
      false,
    );
    expect(
      ExecutionResultSchema.safeParse({ ...result, changedFiles: Array(201).fill("file") }).success,
    ).toBe(false);
    expect(
      ExecutionResultSchema.safeParse({ ...result, changedFiles: Array(200).fill("x".repeat(512)) })
        .success,
    ).toBe(false);
    expect(ExecutionResultSchema.safeParse({ ...result, command: "evil" }).success).toBe(false);
  });
  it.each([
    { agentId: "atlas" },
    { taskId: `task-${randomUUID()}` },
    { executionId: `exec-${randomUUID()}` },
    { requestMessageId: `msg-${randomUUID()}` },
    { changedFiles: ["../secret"] },
  ])("rejects spoofed or stale result %#", (change) => {
    expect(
      correlatedResult(
        { ...message, body: JSON.stringify({ ...result, ...change }) },
        execution,
        task,
      ),
    ).toBeNull();
  });
  it("rejects the wrong sender, wrong recipient, wrong task owner, non-results and duplicate success", () => {
    expect(correlatedResult({ ...message, from: "atlas" }, execution, task)).toBeNull();
    expect(correlatedResult({ ...message, to: "atlas" }, execution, task)).toBeNull();
    expect(correlatedResult(message, execution, { ...task, assignee: "atlas" })).toBeNull();
    expect(correlatedResult({ ...message, type: "message" }, execution, task)).toBeNull();
    expect(correlatedResult(message, { ...execution, status: "succeeded" }, task)).toBeNull();
    expect(correlatedResult({ ...message, body: "not-json" }, execution, task)).toBeNull();
  });
  it("owns automation argv and sends hostile task content only through stdin", () => {
    const def = PROVIDER_DEFINITIONS.find((d) => d.id === "codex");
    if (!def) throw new Error("Missing Codex definition");
    const input = {
      request: {
        kind: "qelvra.task.v1" as const,
        executionId: id,
        taskId,
        agentId: "nova",
        title: "$(touch /evil)",
        description: "--dangerously-bypass-approvals-and-sandbox",
        workspace: "." as const,
        instructions: [],
      },
      requestMessageId,
      agentName: "Nova",
      agentRole: "Developer",
      agentInstructions: "Existing bounded agent.md",
    };
    const command = buildExecutionCommand(
      def,
      {
        file: process.execPath,
        args: [],
        cwd: "/managed/workspace",
        env: { HOME: "/safe" },
        inheritEnv: false,
      },
      input,
      "/server/schema.json",
      "/server/result.json",
    );
    expect(command.args).not.toContain(input.request.description);
    expect(command.args).not.toContain(input.request.title);
    expect(command.args).toContain("workspace-write");
    expect(command.args).toContain("--ignore-user-config");
    expect(command.args).toContain("--no-daemon");
    expect(command.args.join(" ")).not.toMatch(/dangerously|sh -c/);
    expect(command.stdin).toContain(input.request.title);
    expect(command.stdin).toContain("Existing bounded agent.md");
    expect(executionPrompt(input)).not.toContain("memory.md");
  });
});
