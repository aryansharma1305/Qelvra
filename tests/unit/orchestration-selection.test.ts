import { describe, expect, it } from "vitest";
import { AgentSchema } from "@qelvra/shared";
import { selectAgent } from "../../apps/server/src/orchestration/agent-selection.js";
const agent = (id: string, role: string) =>
  AgentSchema.parse({
    id,
    name: id,
    role,
    providerId: "fake",
    status: "stopped",
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T00:00:00.000Z",
  });
describe("deterministic role selection", () => {
  it("prefers exact roles, free capacity within a role and stable agent IDs", () => {
    const agents = [
      agent("zeta", "Frontend Engineer"),
      agent("nova", "Frontend Engineer"),
      agent("atlas", "Backend Engineer"),
    ];
    expect(selectAgent(agents, "Frontend Engineer", new Set())?.id).toBe("nova");
    expect(selectAgent(agents, "Frontend Engineer", new Set(["nova"]))?.id).toBe("zeta");
    expect(selectAgent(agents, "Backend", new Set())?.id).toBe("atlas");
  });
  it("does not assign an unrelated agent just because it is free", () => {
    expect(
      selectAgent([agent("atlas", "Backend Engineer")], "Frontend Engineer", new Set()),
    ).toBeUndefined();
  });
});
