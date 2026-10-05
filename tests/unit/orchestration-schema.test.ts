import { describe, expect, it } from "vitest";
import { OrchestrationPlanSchema, ReviewDecisionSchema } from "@qelvra/shared";

const task = {
  key: "frontend",
  title: "Build frontend",
  description: "Create UI",
  preferredRole: "Frontend Engineer",
  dependsOn: [],
};
describe("orchestration decisions", () => {
  it("accepts a bounded plan and rejects cycles, dangling dependencies and backend commands", () => {
    expect(OrchestrationPlanSchema.safeParse({ summary: "Build UI", tasks: [task] }).success).toBe(
      true,
    );
    for (const tasks of [
      [{ ...task, dependsOn: ["missing"] }],
      [{ ...task, dependsOn: ["frontend"] }],
      [task, task],
      [{ ...task, command: "rm -rf /" }],
      [{ ...task, agentId: "../../../" }],
      Array.from({ length: 21 }, (_, i) => ({ ...task, key: `task${i}` })),
    ]) {
      expect(OrchestrationPlanSchema.safeParse({ summary: "Bad", tasks }).success).toBe(false);
    }
  });
  it("requires useful instructions for rework and rejects arbitrary review actions", () => {
    expect(
      ReviewDecisionSchema.safeParse({
        decision: "rework",
        reason: "Missing API",
        reworkInstructions: "Add the endpoint",
      }).success,
    ).toBe(true);
    expect(
      ReviewDecisionSchema.safeParse({
        decision: "rework",
        reason: "Missing API",
        reworkInstructions: null,
      }).success,
    ).toBe(false);
    expect(
      ReviewDecisionSchema.safeParse({
        decision: "approve",
        reason: "Good",
        reworkInstructions: null,
        action: "run_shell",
      }).success,
    ).toBe(false);
  });
});
