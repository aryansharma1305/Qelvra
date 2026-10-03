// Ported from the Stitch export (agent_hive_multi_agent_terminal_workspace/code.html). Keep visually identical to the design.
import type { Agent, AgentStatus } from "@qelvra/shared";
import { Link } from "react-router";
import { STATUS_LABEL } from "../../features/agents/presentation";

interface SessionTabsProps {
  agents: readonly Agent[];
  selectedId: string | null;
  onSelect: (agentId: string) => void;
}

/** Status dot per lifecycle state, from the design's tab treatments. */
const STATUS_DOT: Record<AgentStatus, string> = {
  created: "bg-outline",
  starting: "bg-secondary animate-pulse",
  running: "bg-tertiary",
  idle: "bg-tertiary",
  working: "bg-secondary animate-ping",
  stopping: "bg-outline animate-pulse",
  stopped: "bg-outline",
  error: "bg-error",
};

function roleTone(role: string) {
  if (/qa|test/i.test(role))
    return {
      avatar: "bg-secondary/20 text-secondary",
      badge: "bg-secondary/10 text-secondary",
      weight: "font-medium",
    };
  if (/orchestrat/i.test(role))
    return {
      avatar: "bg-primary-container/20 text-primary-fixed",
      badge: "bg-surface-container-highest text-outline",
      weight: "",
    };
  return {
    avatar: "bg-surface-container-highest text-outline",
    badge: "bg-surface-container-highest text-outline",
    weight: "",
  };
}

/**
 * One tab per registered agent (the design's session tabs). Selecting a tab only shows
 * that agent's terminal; it never starts the agent.
 */
export function SessionTabs({ agents, selectedId, onSelect }: SessionTabsProps) {
  return (
    <div
      className="terminal-session-tabs flex items-center gap-1.5 overflow-x-auto pb-1 select-none min-w-0"
      role="tablist"
      aria-label="Agent terminals"
    >
      {agents.map((agent) => {
        const selected = agent.id === selectedId;
        const tone = roleTone(agent.role);
        return (
          <button
            key={agent.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-agent={agent.id}
            onClick={() => onSelect(agent.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer group transition-colors ${selected ? "bg-surface-container-high shadow-md" : "bg-surface-container-low hover:bg-surface-container"}`}
          >
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center font-label-sm text-label-sm font-semibold ${selected ? "bg-primary/20 text-primary" : tone.avatar}`}
            >
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    selected
                      ? "font-headline-sm text-headline-sm font-medium text-on-surface shrink-0 max-w-[10rem] truncate"
                      : `font-body-md text-body-md ${tone.weight} text-on-surface-variant shrink-0 max-w-[10rem] truncate`
                  }
                >
                  {agent.name}
                </span>
                <span
                  className={`font-label-sm text-label-sm px-1 rounded max-w-[10rem] line-clamp-2 ${selected ? "bg-primary/10 text-primary" : tone.badge}`}
                >
                  {agent.role}
                </span>
              </div>
              <div
                className={`flex items-center ${selected ? "gap-2" : "gap-1.5"} font-code-sm text-code-sm text-outline`}
                data-terminal-summary
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[agent.status]}`} />
                <span data-testid="tab-status">{STATUS_LABEL[agent.status]}</span>
              </div>
            </div>
            <span
              className="ml-1 text-outline-variant"
              aria-hidden="true"
              title="Session controls are deferred"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </span>
          </button>
        );
      })}
      <Link
        to="/agents/new"
        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-outline hover:text-on-surface font-label-sm text-label-sm text-center transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        <span>New Agent Session</span>
      </Link>
    </div>
  );
}
