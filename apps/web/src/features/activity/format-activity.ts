import type { ActivityEvent } from "@qelvra/shared";
const COLORS = {
  agent: {
    iconBox: "bg-secondary/10 border-secondary/30 text-secondary",
    title: "text-secondary",
    detail: "",
  },
  task: {
    iconBox: "bg-primary/10 border-primary/30 text-primary",
    title: "text-primary",
    detail: "",
  },
  message: {
    iconBox: "bg-tertiary/10 border-tertiary/30 text-tertiary",
    title: "text-tertiary",
    detail: "",
  },
  router: {
    iconBox: "bg-surface-container-high border-outline-variant/30 text-on-surface-variant",
    title: "text-on-surface-variant",
    detail: "",
  },
  error: { iconBox: "bg-error/10 border-error/30 text-error", title: "text-error", detail: "" },
};
export function formatActivityEvent(event: ActivityEvent) {
  const kind = event.type.split(".")[0] as "agent" | "task" | "message" | "router";
  const error = [
    "execution.failed",
    "agent.error",
    "router.error",
    "task.failed",
    "message.delivery_failed",
    "message.quarantined",
  ].includes(event.type);
  const tone = COLORS[error ? "error" : event.type.startsWith("execution.") ? "task" : kind];
  if ("executionId" in event.metadata) {
    return {
      tone,
      icon: error ? "error" : "task_alt",
      title: {
        "execution.started": "Agent execution started",
        "execution.completed": "Agent result ready for review",
        "execution.failed": "Agent execution failed",
        "execution.cancelled": "Agent execution cancelled",
      }[event.type as "execution.started"],
      detail: `${event.metadata.agentId} · ${event.metadata.providerId}${event.metadata.errorCode ? ` · ${event.metadata.errorCode}` : ""}`,
      href: `/tasks?task=${encodeURIComponent(event.metadata.taskId)}`,
    };
  }
  if ("agentName" in event.metadata) {
    const verb = {
      "agent.created": "registered",
      "agent.started": "started",
      "agent.stopped": "stopped",
      "agent.restarted": "restarted",
      "agent.deleted": "deleted",
      "agent.error": "encountered an error",
    }[event.type as "agent.created"];
    return {
      tone,
      icon: error ? "error" : "smart_toy",
      title: `${event.metadata.agentName} ${verb}`,
      detail: error ? "The agent runtime needs attention." : "Agent lifecycle updated",
      href:
        event.type === "agent.deleted"
          ? "/agents"
          : `/agents/${encodeURIComponent(event.entity?.id ?? "")}`,
    };
  }
  if ("taskTitle" in event.metadata) {
    const assignee = event.metadata.assigneeName ?? event.metadata.assigneeId ?? "an agent";
    const verb = {
      "task.created": "created",
      "task.assigned": `assigned to ${assignee}`,
      "task.started": "started",
      "task.review_requested": "moved to Review",
      "task.completed": "completed",
      "task.failed": "failed",
      "task.returned_to_inbox": "returned to Inbox",
    }[event.type as "task.created"];
    return {
      tone,
      icon: error ? "bug_report" : "task_alt",
      title: `${event.metadata.taskTitle} ${verb}`,
      detail: event.metadata.assigneeId ? `Assigned agent: ${assignee}` : "No agent assigned",
      href: `/tasks?task=${encodeURIComponent(event.entity?.id ?? "")}`,
    };
  }
  if ("from" in event.metadata) {
    const from = event.metadata.from,
      to = event.metadata.to;
    const title = {
      "message.queued": `${from} queued a message${to ? ` for ${to}` : ""}`,
      "message.delivered": `${to ?? "Agent"} received a message from ${from}`,
      "message.quarantined": `Message from ${from} quarantined`,
      "message.delivery_failed": `Message from ${from} could not be delivered`,
    }[event.type as "message.queued"];
    return {
      tone,
      icon: error ? "warning" : "forum",
      title,
      detail:
        event.metadata.errorCode ?? `Message type: ${event.metadata.messageType ?? "unknown"}`,
      href: to === "system" ? "/activity" : `/agents/${encodeURIComponent(to ?? from)}`,
    };
  }
  return {
    tone,
    icon: error ? "error" : "hub",
    title: {
      "router.started": "Message router started",
      "router.stopped": "Message router stopped",
      "router.error": "Message router needs attention",
    }[event.type as "router.started"],
    detail: event.metadata.errorCode ?? "Agent mailbox delivery",
    href: "/activity",
  };
}
export function relativeActivityTime(timestamp: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
