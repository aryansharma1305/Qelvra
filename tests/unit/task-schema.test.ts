import { describe, expect, it } from "vitest";
import { TASK_STATUSES, TaskStatusSchema } from "@qelvra/shared";

describe("TaskStatusSchema", () => {
  it("accepts every workflow state", () => {
    for (const status of TASK_STATUSES) expect(TaskStatusSchema.parse(status)).toBe(status);
  });

  it("rejects unknown states", () => {
    expect(TaskStatusSchema.safeParse("done").success).toBe(false);
    expect(TaskStatusSchema.safeParse("").success).toBe(false);
  });
});

import {
  CreateTaskRequestSchema,
  TaskSchema,
  TaskIdSchema,
  TaskTitleSchema,
  TaskDescriptionSchema,
} from "@qelvra/shared";
const task = {
  id: "task-00000000-0000-4000-8000-000000000001",
  title: "Login",
  description: "",
  status: "inbox",
  assignee: null,
  createdBy: "user",
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
};
describe("Task schema", () => {
  it("requires canonical IDs and status/owner/timestamp invariants", () => {
    expect(TaskSchema.parse(task)).toEqual(task);
    for (const invalid of [
      { id: "../task" },
      { createdBy: "atlas" },
      { updatedAt: "2026-10-03T00:00:00.000Z" },
      { status: "working" },
      { assignee: "nova" },
      { priority: "high" },
    ])
      expect(TaskSchema.safeParse({ ...task, ...invalid }).success).toBe(false);
    expect(
      TaskSchema.safeParse({ ...task, status: "completed", assignee: "deleted-agent" }).success,
    ).toBe(true);
    expect(TaskIdSchema.safeParse("task-00000000-0000-1000-8000-000000000001").success).toBe(false);
  });
  it("trims titles, bounds UTF-8 descriptions and allows multiline text", () => {
    expect(
      CreateTaskRequestSchema.parse({
        title: " Login ",
        createdBy: "attacker",
        id: "evil",
        status: "completed",
      }),
    ).toEqual({ title: "Login", description: "" });
    expect(TaskTitleSchema.safeParse("x".repeat(160)).success).toBe(true);
    for (const title of [" ", "x".repeat(161), "bell\u0007", "line\nbreak", "hidden\u200b"])
      expect(TaskTitleSchema.safeParse(title).success).toBe(false);
    expect(TaskDescriptionSchema.safeParse("\tHello\nWorld\r\n" + "x".repeat(16000)).success).toBe(
      true,
    );
    expect(TaskDescriptionSchema.safeParse("x".repeat(16384)).success).toBe(true);
    for (const description of [
      "x".repeat(16385),
      "é".repeat(8193),
      "null\0",
      "bell\u0007",
      "escape\u001b",
      "del\u007f",
    ])
      expect(TaskDescriptionSchema.safeParse(description).success).toBe(false);
    expect(CreateTaskRequestSchema.safeParse({ title: "x", assignee: "../etc" }).success).toBe(
      false,
    );
  });
});
