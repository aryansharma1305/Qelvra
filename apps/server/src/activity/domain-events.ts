import { MessageTypeSchema, ProviderIdSchema } from "@qelvra/shared";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { TaskRegistry } from "../tasks/task-registry.js";
import type { RouterEvent } from "../router/message-router.js";
import type { ActivityPublisher } from "./activity-publisher.js";
/** Registry owns committed identity/status; runtime adds only logical restart. */
export function observeActivity(
  activity: ActivityPublisher,
  agents: AgentRegistry,
  tasks: TaskRegistry,
) {
  return [
    agents.subscribe((event) => {
      const type =
        event.type === "agent.updated"
          ? ({ running: "agent.started", stopped: "agent.stopped", error: "agent.error" } as const)[
              event.agent.status as "running" | "stopped" | "error"
            ]
          : event.type;
      if (!type || (event.type === "agent.updated" && event.previousStatus === event.agent.status))
        return;
      void activity.publish({
        type,
        actor: { type: "system" },
        entity: { type: "agent", id: event.agent.id },
        metadata: {
          agentName: event.agent.name,
          ...(ProviderIdSchema.safeParse(event.agent.providerId ?? "shell").success
            ? { providerId: ProviderIdSchema.parse(event.agent.providerId ?? "shell") }
            : {}),
          ...(type === "agent.error"
            ? {
                errorCode:
                  event.type === "agent.updated"
                    ? (event.errorCode ?? "AGENT_RUNTIME_ERROR")
                    : "AGENT_RUNTIME_ERROR",
              }
            : {}),
        },
      });
    }),
    tasks.subscribe((event) => {
      const name = event.task.assignee ? agents.get(event.task.assignee)?.name : undefined;
      void activity.publish({
        type: event.type === "task.unassigned" ? "task.returned_to_inbox" : event.type,
        actor: { type: "user" },
        entity: { type: "task", id: event.task.id },
        metadata: {
          taskTitle: event.task.title,
          assigneeId: event.task.assignee,
          ...(name ? { assigneeName: name } : {}),
        },
      });
    }),
  ];
}
/** Router owns observation of filesystem outboxes, including writes made by child CLIs. */
export function recordRouterActivity(activity: ActivityPublisher, event: RouterEvent) {
  if (event.type === "message.detected") return;
  if (
    event.type === "router.started" ||
    event.type === "router.stopped" ||
    event.type === "router.error"
  ) {
    void activity.publish({
      type: event.type,
      actor: { type: "system" },
      entity: { type: "router", id: "router" },
      metadata: { ...(event.errorCode ? { errorCode: event.errorCode } : {}) },
    });
    return;
  }
  if (!event.from) return;
  const messageType = MessageTypeSchema.safeParse(event.messageType);
  void activity.publish(
    {
      type: event.type,
      actor: { type: "agent", id: event.from },
      ...(event.messageId ? { entity: { type: "message", id: event.messageId } } : {}),
      metadata: {
        from: event.from,
        ...(event.to ? { to: event.to } : {}),
        ...(messageType.success ? { messageType: messageType.data } : {}),
        ...(event.errorCode ? { errorCode: event.errorCode } : {}),
      },
    },
    event.type === "message.queued" || event.type === "message.delivered",
  );
}
