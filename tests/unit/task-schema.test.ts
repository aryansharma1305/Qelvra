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
