import type { NetworkEdge, NetworkNode, MessageCounts, NetworkResponse } from "@qelvra/shared";
export const baseControl =
  "min-h-11 px-4 py-2 rounded-lg border border-outline-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-wait";
export const control = `${baseControl} bg-surface-container-high hover:bg-surface-bright`;
export const panel =
  "bg-surface-container-low rounded-xl border border-outline-variant/40 p-5 min-w-0";
export const utc = (time: string) => time.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
export const provider = (node: NetworkNode) => node.providerId ?? "Local shell (no AI provider)";
export const messageCounts = (counts: MessageCounts) =>
  `${counts.queued} queued · ${counts.delivered} delivered · ${counts.quarantined} quarantined · ${counts.deliveryFailed} delivery failed`;
export function edgeText(edge: NetworkEdge, names: Map<string, string>) {
  const from = names.get(edge.from) ?? edge.from,
    to = names.get(edge.to) ?? edge.to;
  return edge.kind === "message"
    ? `${from} → ${to}: ${messageCounts(edge.counts)}`
    : `${from} coordinates ${to}: ${edge.goalTotal} goals · ${edge.taskTotal} task assignments`;
}
export const warningText: Record<NetworkResponse["coverage"]["warnings"][number], string> = {
  RETENTION_LIMIT: "Older observations were discarded by the 10,000-event retention limit.",
  RANGE_BEFORE_RETAINED_HISTORY:
    "The selected interval begins before the oldest retained event; earlier traffic may be missing.",
  RECORDING_ERRORS: "Activity recording reported errors; some relationships may be missing.",
  INTEGRITY_WARNINGS: "Unreadable or duplicate journal entries were skipped.",
  JOURNAL_CAP: "The 32 MiB Activity journal cap was reached; new observations may not be recorded.",
};
