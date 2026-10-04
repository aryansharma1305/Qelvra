import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ActivityInputSchema, ActivityEventSchema, ACTIVITY_TYPES } from "@qelvra/shared";
const input = {
  type: "agent.created",
  entity: { type: "agent", id: "nova" },
  metadata: { agentName: "Nova" },
};
describe("canonical activity schema", () => {
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
    expect(ACTIVITY_TYPES).toHaveLength(20);
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
