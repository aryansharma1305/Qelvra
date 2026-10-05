import type { Agent } from "@qelvra/shared";
export function selectAgent(
  agents: readonly Agent[],
  preferredRole: string,
  busy: ReadonlySet<string>,
): Agent | undefined {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const desired = normalize(preferredRole);
  const generic = new Set([
    "engineer",
    "developer",
    "agent",
    "lead",
    "staff",
    "senior",
    "principal",
    "and",
  ]);
  const tokens = desired.split(" ").filter((t) => !generic.has(t));
  const score = (agent: Agent) =>
    normalize(agent.role) === desired
      ? 1000
      : tokens.filter((t) => normalize(agent.role).split(" ").includes(t)).length;
  return agents
    .filter((a) => score(a) > 0)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        Number(busy.has(a.id)) - Number(busy.has(b.id)) ||
        a.id.localeCompare(b.id),
    )[0];
}
