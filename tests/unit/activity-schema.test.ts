import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ActivityInputSchema, ActivityEventSchema, ACTIVITY_TYPES } from "@qelvra/shared";
const input = {
  type: "agent.created",
  entity: { type: "agent", id: "nova" },
  metadata: { agentName: "Nova" },
};
describe("canonical activity schema", () => {
  it("orchestration metadata rejects result bodies, prompts, commands and environment", () => {
    const goalId = `goal-${randomUUID()}`,
      input = {
        type: "orchestration.task_started",
        entity: { type: "orchestration", id: goalId },
        metadata: { goalId, agentId: "nova", taskId: `task-${randomUUID()}`, attempt: 1 },
      };
    expect(ActivityInputSchema.safeParse(input).success).toBe(true);
    for (const key of ["prompt", "result", "command", "env", "body"])
      expect(
        ActivityInputSchema.safeParse({
          ...input,
          metadata: { ...input.metadata, [key]: "PRIVATE" },
        }).success,
      ).toBe(false);
  });
  it("execution metadata accepts only bounded correlation IDs and a controlled error code", () => {
    const execution = {
      type: "execution.failed",
      entity: { type: "task", id: `task-${randomUUID()}` },
      metadata: {
        executionId: `exec-${randomUUID()}`,
        taskId: `task-${randomUUID()}`,
        agentId: "nova",
        providerId: "fake",
        errorCode: "EXECUTION_TIMED_OUT",
      },
    };
    expect(ActivityInputSchema.safeParse(execution).success).toBe(true);
    for (const key of ["prompt", "body", "output", "env", "secret"])
      expect(
        ActivityInputSchema.safeParse({
          ...execution,
          metadata: { ...execution.metadata, [key]: "PRIVATE" },
        }).success,
      ).toBe(false);
    expect(
      ActivityInputSchema.safeParse({ ...execution, entity: { type: "agent", id: "nova" } })
        .success,
    ).toBe(false);
  });
  it("validates server-owned identity and strict metadata", () => {
    const event = { ...input, id: `evt-${randomUUID()}`, timestamp: new Date().toISOString() };
    expect(ActivityEventSchema.parse(event)).toEqual(event);
    for (const key of [
      "body",
      "terminalInput",
      "terminalOutput",
      "description",
      "secret",
      "env",
      "fileContents",
    ]) {
      expect(
        ActivityInputSchema.safeParse({
          ...input,
          metadata: { ...input.metadata, [key]: "PRIVATE_SENTINEL" },
        }).success,
      ).toBe(false);
      expect(ActivityEventSchema.safeParse({ ...event, [key]: "PRIVATE_SENTINEL" }).success).toBe(
        false,
      );
    }
    expect(ActivityInputSchema.safeParse(event).success).toBe(false);
    expect(ActivityEventSchema.safeParse({ ...event, id: "browser-id" }).success).toBe(false);
    expect(ActivityEventSchema.safeParse({ ...event, timestamp: "yesterday" }).success).toBe(false);
    expect(
      ActivityEventSchema.safeParse({ ...event, metadata: { agentName: "x".repeat(81) } }).success,
    ).toBe(false);
    expect(ACTIVITY_TYPES).toHaveLength(49);
  });
  it("rejects mismatched entities and arbitrary message metadata", () => {
    expect(
      ActivityInputSchema.safeParse({ ...input, entity: { type: "task", id: "nova" } }).success,
    ).toBe(false);
    expect(
      ActivityInputSchema.safeParse({
        type: "message.delivered",
        metadata: { from: "nova", to: "atlas", body: "secret" },
      }).success,
    ).toBe(false);
  });
});
