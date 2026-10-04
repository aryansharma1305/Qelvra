// Ported from the Stitch export (agent_hive_nova_profile/code.html). Keep visually identical to the design.

import { useProviders, providerStatus } from "../../features/providers/useProviders";
import type { Agent } from "@qelvra/shared";
import { DeleteAgentButton } from "../../components/agents/DeleteAgentButton";
import type { AgentAction } from "../../features/agents/agents-store";
import {
  STARTABLE_STATUSES,
  STATUS_GROUP,
  STATUS_LABEL,
  STOPPABLE_STATUSES,
  relativeTime,
} from "../../features/agents/presentation";
import type { AgentLifecycleAction } from "../../lib/api";
import { useNow } from "../../hooks/useNow";

const STATUS_PILL = {
  working: { pill: "bg-secondary/10 text-secondary", dot: "bg-secondary", ping: true },
  thinking: { pill: "bg-primary/10 text-primary", dot: "bg-primary", ping: true },
  waiting: {
    pill: "bg-secondary-fixed/10 text-secondary-fixed",
    dot: "bg-secondary-fixed",
    ping: false,
  },
  offline: { pill: "bg-surface-container-high text-outline", dot: "bg-outline", ping: false },
} as const;

const SECONDARY_BUTTON =
  "flex items-center gap-1.5 px-3 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-all shadow-sm disabled:opacity-60 disabled:hover:bg-surface-container";

interface AgentProfileHeaderProps {
  agent: Agent;
  /** The lifecycle action in flight, if any; controls are disabled meanwhile. */
  pending: AgentAction | undefined;
  onAction: (action: AgentLifecycleAction) => void;
  onOpenTerminal: () => void;
  onDelete: () => Promise<void>;
}

export function AgentProfileHeader({
  agent,
  pending,
  onAction,
  onOpenTerminal,
  onDelete,
}: AgentProfileHeaderProps) {
  const now = useNow();
  const { providers, loading, error } = useProviders();
  const provider = providers.find((p) => p.id === (agent.providerId ?? "shell"));
  const busy = pending !== undefined;
  const canStart = STARTABLE_STATUSES.includes(agent.status);
  const canStop = STOPPABLE_STATUSES.includes(agent.status);
  // The design's "Pause" slot: Start or Stop. There is no pause (no fake SIGSTOP).
  const toggle = canStart
    ? {
        action: "start" as const,
        icon: "play_arrow",
        label: pending === "start" ? "Starting…" : "Start",
      }
    : { action: "stop" as const, icon: "stop", label: pending === "stop" ? "Stopping…" : "Stop" };
  const tone = STATUS_PILL[STATUS_GROUP[agent.status]];
  return (
    <div className="relative bg-surface-container-lowest rounded-xl p-space-lg shadow-xl overflow-hidden">
      {" "}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg relative z-10">
        <div className="flex items-start sm:items-center gap-space-lg">
          <div className="relative flex-shrink-0 group">
            {" "}
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-primary-container via-secondary to-tertiary rounded-2xl opacity-40 blur-md group-hover:opacity-70 transition-opacity animate-pulse" />{" "}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-surface-container-low flex items-center justify-center overflow-hidden shadow-2xl">
              <svg
                className="w-full h-full p-2"
                fill="none"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                {" "}
                <circle
                  className="text-outline-variant/40"
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />{" "}
                <polygon
                  className="text-secondary/60"
                  fill="currentColor"
                  fillOpacity="0.05"
                  points="50,15 80,32 80,68 50,85 20,68 20,32"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />{" "}
                <polygon
                  className="text-primary"
                  points="50,26 71,38 71,62 50,74 29,62 29,38"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />{" "}
                <circle
                  className="fill-primary-container animate-ping"
                  cx="50"
                  cy="50"
                  opacity="0.3"
                  r="10"
                />{" "}
                <circle className="fill-secondary" cx="50" cy="50" r="7" />{" "}
                <circle className="fill-tertiary" cx="50" cy="15" r="2.5" />{" "}
                <circle className="fill-primary" cx="80" cy="68" r="2.5" />{" "}
                <circle className="fill-secondary" cx="20" cy="68" r="2.5" />{" "}
              </svg>
              <div className="absolute bottom-1 right-1 px-1 rounded bg-surface-container-lowest font-label-sm text-label-sm text-secondary max-w-[80%] truncate">
                {agent.id}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-space-xs sm:gap-space-sm">
              <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface font-semibold">
                {agent.name}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[13px]">fingerprint</span>
                {agent.id}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-code-sm text-code-sm ${tone.pill}`}
                data-testid="agent-status"
              >
                <span className="relative flex h-2 w-2">
                  {tone.ping && (
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${tone.dot}`}
                    />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${tone.dot}`} />
                </span>
                {STATUS_LABEL[agent.status].toUpperCase()}
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant font-medium">
              {agent.role}
            </p>
            <div className="flex flex-wrap items-center gap-space-xs pt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px] text-outline">
                  psychology
                </span>
                <span data-testid="agent-provider">
                  {provider?.name ?? agent.providerId ?? "Local shell"} ·{" "}
                  {provider
                    ? providerStatus(provider)
                    : loading
                      ? "Checking availability…"
                      : error
                        ? "Availability unknown"
                        : "Unknown provider"}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                <time dateTime={agent.createdAt} title={new Date(agent.createdAt).toLocaleString()}>
                  created {relativeTime(agent.createdAt, now)}
                </time>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-space-xs self-start xl:self-center">
          <DeleteAgentButton agentName={agent.name} onDelete={onDelete} />
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled
            title="Messaging arrives with the mailbox"
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
            <span>Message</span>
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={busy || (!canStart && !canStop)}
            onClick={() => onAction(toggle.action)}
          >
            <span className="material-symbols-outlined text-[16px]">{toggle.icon}</span>
            <span>{toggle.label}</span>
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={busy || (!canStart && !canStop)}
            onClick={() => onAction("restart")}
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>{pending === "restart" ? "Restarting…" : "Restart"}</span>
          </button>
          <button
            type="button"
            onClick={onOpenTerminal}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:bg-primary-fixed-dim transition-all shadow-[0_0_20px_rgba(208,188,255,0.25)] disabled:opacity-60 disabled:hover:bg-primary"
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            <span>Open Terminal</span>
            <kbd className="ml-1 px-1 py-0.2 rounded bg-on-primary/20 text-on-primary font-label-sm text-label-sm">
              ⌘T
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
