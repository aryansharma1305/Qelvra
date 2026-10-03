// Ported from the Stitch export (agent_hive_ai_team_directory/code.html). Keep visually identical to the design.
import type { Agent } from "@qelvra/shared";
import { DeleteAgentButton } from "../../components/agents/DeleteAgentButton";
import type { AgentAction } from "../../features/agents/agents-store";
import {
  ACTIVE_STATUSES,
  STARTABLE_STATUSES,
  STATUS_GROUP,
  STATUS_LABEL,
  STOPPABLE_STATUSES,
  relativeTime,
} from "../../features/agents/presentation";
import { useNow } from "../../hooks/useNow";

interface AgentDrawerProps {
  agent: Agent;
  open: boolean;
  pending: AgentAction | undefined;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onToggle: (action: "start" | "stop") => void;
  onOpenTerminal: () => void;
}

const BADGE_TONE = {
  working: "bg-secondary/15 text-secondary",
  thinking: "bg-primary/15 text-primary",
  waiting: "bg-secondary-fixed/20 text-secondary-fixed",
  offline: "bg-surface-container-high text-outline",
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-on-surface font-body-sm text-body-sm">
      <span>{label}</span>
      <span className="font-mono text-on-surface-variant text-right truncate">{children}</span>
    </div>
  );
}

// The design's drawer, showing the registry's real fields. Settings that do not exist yet
// (directive, hyperparameters, tools, hardware) are not shown as if they were configured.
export function AgentDrawer({
  agent,
  open,
  pending,
  onClose,
  onDelete,
  onToggle,
  onOpenTerminal,
}: AgentDrawerProps) {
  const now = useNow();
  const canStart = STARTABLE_STATUSES.includes(agent.status);
  const canStop = STOPPABLE_STATUSES.includes(agent.status);
  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface-container-low shadow-2xl transform ${open ? "" : "translate-x-full "}transition-transform duration-300 ease-in-out flex flex-col justify-between overflow-hidden`}
      id="agent-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`${agent.name} details`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-80px)]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center"
              id="drawer-avatar"
            >
              <span className="material-symbols-outlined text-[28px] text-primary">smart_toy</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className="font-headline-md text-headline-md font-semibold text-on-surface"
                  id="drawer-name"
                >
                  {agent.name}
                </span>
                <span
                  className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${BADGE_TONE[STATUS_GROUP[agent.status]]}`}
                  id="drawer-badge"
                >
                  {STATUS_LABEL[agent.status]}
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-outline" id="drawer-role">
                {agent.role}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg bg-surface-container-high text-outline hover:text-on-surface transition-colors"
            id="close-drawer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-container-lowest shadow-sm">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Identity
          </span>
          <Row label="Agent ID">{agent.id}</Row>
          <Row label="Role">{agent.role}</Row>
          <Row label="Status">{STATUS_LABEL[agent.status]}</Row>
          <Row label="Created">
            <time dateTime={agent.createdAt} title={new Date(agent.createdAt).toLocaleString()}>
              {relativeTime(agent.createdAt, now)}
            </time>
          </Row>
        </div>
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-container-lowest shadow-sm">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Provider &amp; Runtime
          </span>
          <Row label="Provider">{agent.providerId ?? "Not configured"}</Row>
          <Row label="Process">
            {ACTIVE_STATUSES.includes(agent.status) ? "Local shell" : "Not running"}
          </Row>
          <Row label="Workspace">{`hive/agents/${agent.id}/workspace`}</Row>
          <p className="font-code-sm text-code-sm text-outline pt-1">
            System directive, tools and model settings become available with AI providers.
          </p>
        </div>
      </div>
      <div className="p-4 bg-surface-container flex items-center justify-between shadow-lg">
        <DeleteAgentButton agentName={agent.name} onDelete={onDelete} />
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-body-sm text-body-sm transition-colors disabled:opacity-60"
            type="button"
            disabled={pending !== undefined || (!canStart && !canStop)}
            onClick={() => onToggle(canStart ? "start" : "stop")}
          >
            <span className="material-symbols-outlined text-[16px]">
              {canStart ? "play_arrow" : "stop"}
            </span>
            <span>{canStart ? "Start" : "Stop"}</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-highest text-on-surface hover:bg-surface-bright font-body-sm text-body-sm transition-colors"
            type="button"
            onClick={onOpenTerminal}
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            <span>Open Terminal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
