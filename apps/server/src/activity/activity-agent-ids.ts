import type { ActivityEvent } from "@qelvra/shared";

/** The Activity filter's association rules, shared with retained-history analytics. */
export function activityAgentIds(event: ActivityEvent): string[] {
  const ids = new Set<string>();
  if (event.entity?.type === "agent") ids.add(event.entity.id);
  if (event.actor?.type === "agent" && event.actor.id) ids.add(event.actor.id);
  if ("agentId" in event.metadata && event.metadata.agentId) ids.add(event.metadata.agentId);
  if ("assigneeId" in event.metadata && event.metadata.assigneeId)
    ids.add(event.metadata.assigneeId);
  if ("from" in event.metadata) {
    ids.add(event.metadata.from);
    if (event.metadata.to) ids.add(event.metadata.to);
  }
  return [...ids];
}
