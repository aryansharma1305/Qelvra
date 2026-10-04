import { AgentIdSchema } from "@qelvra/shared";
import { describe, expect, it } from "vitest";
import { HOME_OPERATIVES, SWARM_OPERATIVES } from "../../apps/web/src/mocks/agents";
// Design mock data still used by the Home and Swarm dashboards must respect the
// shared contracts the real data will use.

const unique = (values: readonly string[]) => new Set(values).size === values.length;

describe("mock data respects shared contracts", () => {
  it.each([
    ["home", HOME_OPERATIVES],
    ["swarm", SWARM_OPERATIVES],
  ] as const)("%s agents have valid, unique ids", (_name, agents) => {
    for (const agent of agents) expect(AgentIdSchema.safeParse(agent.id).success).toBe(true);
    expect(unique(agents.map((agent) => agent.id))).toBe(true);
  });
});
