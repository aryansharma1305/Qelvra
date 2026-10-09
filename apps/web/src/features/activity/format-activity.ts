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
    "orchestration.failed",
    "execution.failed",
    "agent.error",
    "router.error",
    "task.failed",
    "message.delivery_failed",
    "message.quarantined",
  ].includes(event.type);
  const tone =
    COLORS[
      error
        ? "error"
        : /^(execution|orchestration|file|memory|automation)\./.test(event.type)
          ? "task"
          : kind
    ];
  if ("automationId" in event.metadata)
    return {
      tone,
      icon: "schedule",
      title: `Automation ${(event.type.split(".")[1] ?? "updated").replaceAll("_", " ")}`,
      detail: [event.metadata.status, event.metadata.errorCode].filter(Boolean).join(" · "),
      href: `/automations?automation=${encodeURIComponent(event.metadata.automationId)}`,
    };
  if (event.type === "memory.updated")
    return {
      tone,
      icon: "psychology",
      title: "Agent memory saved",
      detail: `${event.metadata.agentId} · ${event.metadata.size} bytes`,
      href: `/memory?agent=${encodeURIComponent(event.metadata.agentId)}`,
    };
  if ("relativePath" in event.metadata) {
    const action = {
      "file.created": "created",
      "file.updated": "saved",
      "file.renamed": "renamed",
      "file.deleted": "deleted",
    }[event.type as "file.created"];
    const params = new URLSearchParams({ agent: event.metadata.agentId });
    if (event.type !== "file.deleted") params.set("file", event.metadata.relativePath);
    return {
      tone,
      icon: "description",
      title: `File ${action}`,
      detail: `${event.metadata.agentId} · ${event.metadata.previousPath ? event.metadata.previousPath + " → " : ""}${event.metadata.relativePath}`,
      href: `/files?${params}`,
    };
  }
  if ("goalId" in event.metadata) {
    const titles = {
      "orchestration.created": "Goal created",
      "orchestration.planning": "Goal planning started",
      "orchestration.planned": "Goal plan ready",
      "orchestration.started": "Goal execution started",
      "orchestration.task_started": "Goal task started",
      "orchestration.task_approved": "Goal task approved",
      "orchestration.task_rework": "Goal task needs rework",
      "orchestration.completed": "Goal completed",
      "orchestration.failed": "Goal failed",
      "orchestration.cancelled": "Goal cancelled",
      "orchestration.paused": "Goal paused after restart",
      "orchestration.resumed": "Goal resumed",
    };
    return {
      tone,
      icon: error ? "error" : "account_tree",
      title: titles[event.type as keyof typeof titles],
      detail: [
        event.metadata.agentId,
        event.metadata.attempt ? `Attempt ${event.metadata.attempt}` : "",
        event.metadata.errorCode,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/tasks?view=goals&goal=${encodeURIComponent(event.metadata.goalId)}`,
    };
  }
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
