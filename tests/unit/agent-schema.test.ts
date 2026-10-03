import { describe, expect, it } from "vitest";
import { AgentIdSchema, AgentStatusSchema } from "@qelvra/shared";

describe("AgentIdSchema", () => {
  it.each(["nova", "frontend-2", "a", "orchestrator"])("accepts %s", (id) => {
    expect(AgentIdSchema.safeParse(id).success).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["parent traversal", ".."],
    ["nested traversal", "../etc"],
    ["forward slash", "a/b"],
    ["backslash", "a\\b"],
    ["uppercase", "Nova"],
    ["leading hyphen", "-nova"],
    ["trailing hyphen", "nova-"],
    ["whitespace", "no va"],
    ["null byte", "nova\u0000"],
    ["too long", "a".repeat(65)],
  ])("rejects %s", (_label, id) => {
    expect(AgentIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("AgentStatusSchema", () => {
  it("accepts every known status", () => {
    for (const status of AgentStatusSchema.options) {
      expect(AgentStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects unknown statuses", () => {
    expect(AgentStatusSchema.safeParse("paused").success).toBe(false);
  });
});
