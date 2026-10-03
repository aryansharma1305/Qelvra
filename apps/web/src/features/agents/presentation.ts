import type { Agent, AgentStatus } from "@qelvra/shared";

// How real agent data is shown in the Stitch agent UI. Runtime fields that do not exist
// yet (context window, current task, skills, model) are shown as explicitly
// not configured, never as invented values.

/** The Agents page's status tabs group the lifecycle states. */
export type StatusGroup = "working" | "thinking" | "waiting" | "offline";

// "Working" is reserved for agents doing a task (task system, PR 12). An agent whose shell
// is up but has no task is "Running" and sits with the waiting agents.
export const STATUS_GROUP: Record<AgentStatus, StatusGroup> = {
  working: "working",
  starting: "waiting",
  running: "waiting",
  idle: "waiting",
  created: "offline",
  stopping: "offline",
  stopped: "offline",
  error: "offline",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  created: "Created",
  starting: "Starting",
  running: "Running",
  idle: "Idle",
  working: "Working",
  stopping: "Stopping",
  stopped: "Stopped",
  error: "Error",
};

/** Statuses that count as "active" (an agent process exists). */
export const ACTIVE_STATUSES: readonly AgentStatus[] = ["starting", "running", "idle", "working"];

/** Statuses in which an agent can be started, and in which it can be stopped. */
export const STARTABLE_STATUSES: readonly AgentStatus[] = ["created", "stopped", "error"];
export const STOPPABLE_STATUSES: readonly AgentStatus[] = ["running", "idle", "working", "error"];

/** Visual tokens copied from the design's cards (Nova = working, Pixel = waiting, Echo = offline). */
export interface CardTone {
  glow: string;
  presenceDot: string;
  opIdBadge: string;
  modelDot: string;
  activityPanel: string;
  status: string;
  statusDot: string;
  statusMeta: string;
  task: string;
  workspace: string;
  workspaceIcon: string;
  lastActive: string;
  contextPercent: string;
  contextBar: string;
  runtimeIcon: string;
}

const TONES: Record<StatusGroup, CardTone> = {
  working: {
    glow: "from-secondary/5 via-primary/5",
    presenceDot: "bg-secondary shadow-[0_0_8px_#4cd7f6]",
    opIdBadge: "bg-secondary/15 text-secondary",
    modelDot: "bg-secondary-container",
    activityPanel: "",
    status: "text-secondary",
    statusDot: "bg-secondary animate-ping",
    statusMeta: "text-outline font-code-sm text-code-sm",
    task: "text-on-surface",
    workspace: "text-on-surface-variant",
    workspaceIcon: "text-primary",
    lastActive: "text-tertiary",
    contextPercent: "text-secondary",
    contextBar: "bg-secondary w-0",
    runtimeIcon: "text-tertiary",
  },
  thinking: {
    glow: "from-primary/5 via-secondary/5",
    presenceDot: "bg-primary shadow-[0_0_8px_#a078ff]",
    opIdBadge: "bg-primary/15 text-primary",
    modelDot: "bg-primary-container",
    activityPanel: "",
    status: "text-primary",
    statusDot: "bg-primary animate-pulse",
    statusMeta: "text-outline font-code-sm text-code-sm",
    task: "text-on-surface",
    workspace: "text-on-surface-variant",
    workspaceIcon: "text-primary",
    lastActive: "text-outline",
    contextPercent: "text-primary",
    contextBar: "bg-primary w-0",
    runtimeIcon: "text-primary",
  },
  waiting: {
    glow: "from-secondary-fixed/5 via-primary-fixed/5",
    presenceDot: "bg-secondary-fixed shadow-[0_0_8px_#acedff]",
    opIdBadge: "bg-secondary-fixed/20 text-secondary-fixed",
    modelDot: "bg-secondary",
    activityPanel: "",
    status: "text-secondary-fixed",
    statusDot: "bg-secondary-fixed",
    statusMeta: "text-outline font-code-sm text-code-sm",
    task: "text-on-surface",
    workspace: "text-on-surface-variant",
    workspaceIcon: "text-primary",
    lastActive: "text-outline",
    contextPercent: "text-secondary-fixed",
    contextBar: "bg-secondary-fixed-dim w-0",
    runtimeIcon: "text-tertiary",
  },
  offline: {
    glow: "from-surface-container-highest/20 via-surface-container-high/10",
    presenceDot: "bg-outline",
    opIdBadge: "bg-surface-container-high text-outline",
    modelDot: "bg-outline",
    activityPanel: "opacity-75",
    status: "text-outline",
    statusDot: "bg-outline",
    statusMeta: "text-outline font-code-sm text-code-sm",
    task: "text-on-surface-variant",
    workspace: "text-outline",
    workspaceIcon: "",
    lastActive: "text-outline",
    contextPercent: "text-outline",
    contextBar: "bg-outline w-0",
    runtimeIcon: "",
  },
};

/** Everything the directory card renders. */
export interface DirectoryCardView {
  id: string;
  status: StatusGroup;
  name: string;
  opId: string;
  role: string;
  model: string;
  bio: string;
  statusLabel: string;
  statusMeta: string;
  currentTask: string;
  workspaceIcon: string;
  workspace: string;
  lastActive: string;
  contextUsage: string;
  contextPercent: string;
  skills: readonly string[];
  runtimeIcon: string;
  runtime: string;
  tone: CardTone;
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(Math.round(seconds / 60), "minute");
}

export function toDirectoryCard(agent: Agent, now: number = Date.now()): DirectoryCardView {
  const group = STATUS_GROUP[agent.status];
  const hasProcess = ACTIVE_STATUSES.includes(agent.status);
  return {
    id: agent.id,
    status: group,
    name: agent.name,
    opId: agent.id,
    role: agent.role,
    model: agent.providerId ?? "No provider",
    bio: "Provider, workspace and capabilities are not configured yet.",
    statusLabel: STATUS_LABEL[agent.status],
    statusMeta: hasProcess
      ? "local shell"
      : agent.status === "error"
        ? "check terminal"
        : "no process",
    currentTask: "No active task",
    workspaceIcon: "folder_off",
    workspace: `hive/agents/${agent.id}/workspace`,
    lastActive: hasProcess
      ? `since ${relativeTime(agent.updatedAt, now)}`
      : `created ${relativeTime(agent.createdAt, now)}`,
    contextUsage: hasProcess ? "No model" : "Not running",
    contextPercent: "",
    skills: ["No capabilities configured"],
    runtimeIcon: hasProcess ? "terminal" : "power_settings_new",
    runtime: hasProcess ? "Shell running" : "Runtime not started",
    tone: TONES[group],
  };
}
