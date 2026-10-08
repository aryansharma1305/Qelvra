import {
  ANALYTICS_MAX_DAYS,
  AnalyticsQuerySchema,
  AnalyticsResponseSchema,
  type AnalyticsQuery,
  type AnalyticsResponse,
  type AnalyticsWarning,
} from "@qelvra/shared";
import type { ActivityPublisher } from "../activity/activity-publisher.js";
import { activityAgentIds } from "../activity/activity-agent-ids.js";
import type { AgentRegistry } from "../agents/agent-registry.js";
import { AppError } from "../lib/errors.js";

const DAY = 86_400_000;
export function analyticsRange(query: AnalyticsQuery, now = new Date()) {
  const time = (value: string) => {
    const date = new Date(value.length === 10 ? value + "T00:00:00.000Z" : value);
    if (
      !Number.isFinite(date.getTime()) ||
      (value.length === 10 && date.toISOString().slice(0, 10) !== value)
    )
      throw new AppError(400, "ANALYTICS_INVALID_QUERY", "Use valid UTC dates or ISO timestamps");
    return date.getTime();
  };
  const to = query.to ? time(query.to) : now.getTime();
  const from = query.from ? time(query.from) : to - 7 * DAY;
  if (from >= to || to - from > ANALYTICS_MAX_DAYS * DAY)
    throw new AppError(
      400,
      "ANALYTICS_INVALID_QUERY",
      "Choose a non-empty range of at most 90 days; the end is exclusive",
    );
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

/** Observes one validated retained snapshot; never writes domain or analytics state. */
export class AnalyticsService {
  constructor(
    private readonly activity: ActivityPublisher,
    private readonly registry: AgentRegistry,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async get(raw: AnalyticsQuery = {}): Promise<AnalyticsResponse> {
    const parsed = AnalyticsQuerySchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError(400, "ANALYTICS_INVALID_QUERY", "Invalid analytics filters");
    const query = parsed.data;
    if (query.agentId && !this.registry.get(query.agentId))
      throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found");
    const range = analyticsRange(query, this.now());
    await this.activity.flush();
    const snapshot = this.activity.store.getSnapshot();
    const status = this.activity.status();
    const from = Date.parse(range.from),
      to = Date.parse(range.to);
    const daily = new Map<string, number>();
    for (let day = Math.floor(from / DAY) * DAY; day < to; day += DAY)
      daily.set(new Date(day).toISOString().slice(0, 10), 0);
    const types = new Map<AnalyticsResponse["byType"][number]["type"], number>();
    const involvement = new Map<string, number>();
    const taskOutcomes = { completed: 0, failed: 0, reviewRequested: 0, returnedToInbox: 0 };
    const goalOutcomes = { completed: 0, failed: 0, cancelled: 0 };
    let recordedEvents = 0,
      messagesDelivered = 0,
      executionEvents = 0;
    for (const event of snapshot.events) {
      const at = Date.parse(event.timestamp);
      if (at < from || at >= to) continue;
      const ids = activityAgentIds(event);
      if (query.agentId && !ids.includes(query.agentId)) continue;
      recordedEvents++;
      const day = event.timestamp.slice(0, 10);
      daily.set(day, (daily.get(day) ?? 0) + 1);
      types.set(event.type, (types.get(event.type) ?? 0) + 1);
      for (const id of ids) involvement.set(id, (involvement.get(id) ?? 0) + 1);
      if (event.type === "task.completed") taskOutcomes.completed++;
      if (event.type === "task.failed") taskOutcomes.failed++;
      if (event.type === "task.review_requested") taskOutcomes.reviewRequested++;
      if (event.type === "task.returned_to_inbox") taskOutcomes.returnedToInbox++;
      if (event.type === "orchestration.completed") goalOutcomes.completed++;
      if (event.type === "orchestration.failed") goalOutcomes.failed++;
      if (event.type === "orchestration.cancelled") goalOutcomes.cancelled++;
      if (event.type === "message.delivered") messagesDelivered++;
      if (event.type.startsWith("execution.")) executionEvents++;
    }
    const registered = new Map(this.registry.list().map((agent) => [agent.id, agent]));
    const agents = [...involvement]
      .map(([agentId, recordedInvolvement]) => {
        const agent = registered.get(agentId);
        return {
          agentId,
          name: agent?.name ?? null,
          role: agent?.role ?? null,
          registered: !!agent,
          recordedInvolvement,
        };
      })
      .sort(
        (a, b) =>
          b.recordedInvolvement - a.recordedInvolvement || a.agentId.localeCompare(b.agentId),
      );
    const warnings: AnalyticsWarning[] = [];
    if (snapshot.retentionTruncated) warnings.push("RETENTION_LIMIT");
    if (snapshot.oldestRetainedAt && from < Date.parse(snapshot.oldestRetainedAt))
      warnings.push("RANGE_BEFORE_RETAINED_HISTORY");
    if (status.degraded || status.consecutiveFailures > 0) warnings.push("RECORDING_ERRORS");
    if (status.integrityWarnings > 0) warnings.push("INTEGRITY_WARNINGS");
    if (status.capped) warnings.push("JOURNAL_CAP");
    return AnalyticsResponseSchema.parse({
      range,
      filter: { agentId: query.agentId ?? null },
      summary: {
        recordedEvents,
        involvedAgents: involvement.size,
        taskOutcomeEvents: Object.values(taskOutcomes).reduce((a, b) => a + b, 0),
        goalOutcomeEvents: Object.values(goalOutcomes).reduce((a, b) => a + b, 0),
        messagesDelivered,
        executionEvents,
      },
      daily: [...daily].map(([date, recordedEvents]) => ({ date, recordedEvents })),
      byType: [...types]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
      taskOutcomes,
      goalOutcomes,
      agents,
      coverage: {
        retainedEvents: snapshot.retainedEvents,
        oldestRetainedAt: snapshot.oldestRetainedAt,
        newestRetainedAt: snapshot.newestRetainedAt,
        recordingHealthy: !status.degraded && status.consecutiveFailures === 0,
        historyMayBeTruncated: warnings.length > 0,
        warnings,
        status,
      },
      unavailable: { tokenUsage: null, providerCost: null, machineUtilization: null },
    });
  }
}
