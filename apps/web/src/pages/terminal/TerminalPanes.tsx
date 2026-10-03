// Ported from the Stitch export (agent_hive_multi_agent_terminal_workspace/code.html). Keep visually identical to the design.
import type { Agent } from "@qelvra/shared";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { reloadAgent, runAgentAction, type AgentAction } from "../../features/agents/agents-store";
import {
  STARTABLE_STATUSES,
  STATUS_LABEL,
  STOPPABLE_STATUSES,
} from "../../features/agents/presentation";
import { RealTerminal, type TerminalStatus } from "../../features/terminal/RealTerminal";
import type { TerminalConnectionState } from "../../features/terminal/terminal-client";

const STATE_PRESENTATION: Record<
  TerminalConnectionState,
  { label: string; text: string; dot: string }
> = {
  connecting: { label: "CONNECTING", text: "text-outline", dot: "bg-outline animate-pulse" },
  creating: { label: "STARTING PTY", text: "text-outline", dot: "bg-outline animate-pulse" },
  connected: { label: "PTY", text: "text-tertiary", dot: "bg-tertiary" },
  exited: { label: "EXITED", text: "text-outline", dot: "bg-outline" },
  disconnected: { label: "DISCONNECTED", text: "text-error", dot: "bg-error" },
  error: { label: "ERROR", text: "text-error", dot: "bg-error" },
};

const INITIAL_STATUS: TerminalStatus = { state: "connecting", session: null, cols: 0, rows: 0 };
const LINK_BUTTON = "text-primary hover:text-primary-fixed transition-colors disabled:opacity-50";

function shellName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

interface PaneFrameProps {
  id: string;
  bodyId: string;
  /** Left of the "@" in the header (shell or agent name). */
  title: string;
  /** Right of the "@" (cwd or a short note). */
  location: string;
  tooltip?: string | undefined;
  status: ReactNode;
  actions?: ReactNode;
  state: string;
  /** The agent shown, if any (lets tests and tools tell panes apart). */
  agentId?: string | undefined;
  children: ReactNode;
  developer?: boolean;
}

/** The design's terminal pane chrome: traffic lights, title bar, 410px body. */
function PaneFrame(props: PaneFrameProps) {
  return (
    <div
      className={`flex flex-col rounded-xl bg-surface-container-lowest shadow-xl overflow-hidden min-w-0 h-[460px] ${props.developer ? "developer-terminal-pane" : ""}`}
      id={props.id}
      data-terminal-state={props.state}
      data-agent={props.agentId}
    >
      <div className="terminal-pane-header flex items-center justify-between gap-2 px-3.5 py-2 bg-surface-container-low select-none shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2.5 h-2.5 rounded-full ${props.developer ? "bg-outline-variant" : "bg-error/70"}`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full ${props.developer ? "bg-outline-variant" : "bg-secondary/50"}`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full ${props.developer ? "bg-outline-variant" : "bg-tertiary/70"}`}
            />
          </div>
          <div
            className="flex items-center gap-1.5 pl-2 font-code-sm text-code-sm text-outline truncate"
            title={props.tooltip}
          >
            <span
              className={`${props.developer ? "text-secondary" : "text-primary"} font-medium truncate`}
              title={props.title}
              data-terminal-title
            >
              {props.title}
            </span>
            <span className="text-outline-variant">@</span>
            <span className="truncate" data-terminal-location>
              {props.location}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-label-sm text-label-sm text-outline shrink-0 whitespace-nowrap">
          {props.status}
          {props.actions}
        </div>
      </div>
      <div
        className="p-3.5 h-[410px] min-w-0 min-h-0 shrink-0 overflow-hidden bg-surface-container-lowest/80"
        id={props.bodyId}
      >
        {props.children}
      </div>
    </div>
  );
}

function ConnectionStatus({ status }: { status: TerminalStatus }) {
  const presentation = STATE_PRESENTATION[status.state];
  return (
    <>
      <span
        className={`${presentation.text} flex items-center gap-1`}
        role="status"
        aria-live="polite"
        data-testid="terminal-status"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${presentation.dot}`} />
        {presentation.label}
        {status.state === "connected" && status.session?.pid != null && ` ${status.session.pid}`}
      </span>
      {status.cols > 0 && (
        <span>
          {status.cols}x{status.rows}
        </span>
      )}
    </>
  );
}

function isEnded(state: TerminalConnectionState): boolean {
  return state === "exited" || state === "disconnected" || state === "error";
}

/** A message in the pane body, in place of terminal output that does not exist. */
function PaneNotice({ children }: { children: ReactNode }) {
  return (
    <div className="h-full min-w-0 overflow-y-auto break-words flex flex-col items-center justify-center gap-3 text-center font-code-sm text-code-sm text-outline">
      {children}
    </div>
  );
}

interface AgentPaneProps {
  agent: Agent | undefined;
  pending: AgentAction | undefined;
  /** Shown when there is no agent to select. */
  emptyMessage: string;
  loadError?: string | null;
  onRetry?: () => void;
}

/**
 * The selected agent's terminal: the design's first pane. A running agent's shell is
 * attached; leaving the page only detaches it. A stopped agent shows Start instead of
 * pretending there is output.
 */
export function AgentPane({ agent, pending, emptyMessage, loadError, onRetry }: AgentPaneProps) {
  if (!agent) {
    return (
      <PaneFrame
        id="live-terminal-pane"
        bodyId="nova-terminal-body"
        title="agent"
        location="none selected"
        status={null}
        state="none"
      >
        <PaneNotice>
          <p role={loadError ? "alert" : undefined}>{loadError ?? emptyMessage}</p>
          {loadError ? (
            <button type="button" className={LINK_BUTTON} onClick={onRetry}>
              Retry
            </button>
          ) : (
            <Link to="/agents/new" className={LINK_BUTTON}>
              Create an agent
            </Link>
          )}
        </PaneNotice>
      </PaneFrame>
    );
  }
  // Keyed by agent: switching agents gets a fresh view, never another agent's output.
  return <AgentTerminal key={agent.id} agent={agent} pending={pending} />;
}

function AgentTerminal({ agent, pending }: { agent: Agent; pending: AgentAction | undefined }) {
  const [status, setStatus] = useState<TerminalStatus>(INITIAL_STATUS);
  const [generation, setGeneration] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const running =
    agent.status === "running" || agent.status === "idle" || agent.status === "working";
  const ended = isEnded(status.state);

  // When the attached shell ends (stopped elsewhere, exited, or not running), the agent's
  // status has changed on the server: fetch it so the pane and tabs show the truth.
  useEffect(() => {
    if (ended) void reloadAgent(agent.id);
  }, [ended, agent.id]);

  const act = (action: "start" | "stop" | "restart") => {
    setActionError(null);
    runAgentAction(agent.id, action).then(
      () => {
        setStatus(INITIAL_STATUS);
        setGeneration((value) => value + 1);
      },
      (error: unknown) =>
        setActionError(error instanceof Error ? error.message : `Could not ${action} agent`),
    );
  };

  const busy = pending !== undefined;
  const actions = (
    <>
      {running && ended && (
        <button
          type="button"
          className={LINK_BUTTON}
          disabled={busy}
          onClick={() => {
            setStatus(INITIAL_STATUS);
            setGeneration((value) => value + 1);
          }}
        >
          Reconnect
        </button>
      )}
      {STOPPABLE_STATUSES.includes(agent.status) && (
        <button type="button" className={LINK_BUTTON} disabled={busy} onClick={() => act("stop")}>
          {pending === "stop" ? "Stopping…" : "Stop"}
        </button>
      )}
      {running && (
        <button
          type="button"
          className={LINK_BUTTON}
          disabled={busy}
          onClick={() => act("restart")}
        >
          {pending === "restart" ? "Restarting…" : "Restart"}
        </button>
      )}
    </>
  );

  if (running) {
    return (
      <PaneFrame
        id="live-terminal-pane"
        bodyId="nova-terminal-body"
        title={agent.name}
        location={status.session ? status.session.cwd : "local"}
        tooltip={status.session ? `${status.session.shell} in ${status.session.cwd}` : undefined}
        status={<ConnectionStatus status={status} />}
        actions={actions}
        state={status.state}
        agentId={agent.id}
      >
        <div className="h-full min-h-0 min-w-0 flex flex-col gap-2">
          {actionError && (
            <p
              role="alert"
              className="text-error font-code-sm text-code-sm max-h-20 overflow-y-auto break-words shrink-0"
            >
              {actionError}
            </p>
          )}
          <div className="flex-1 min-h-0">
            <RealTerminal key={generation} agentId={agent.id} onStatusChange={setStatus} />
          </div>
        </div>
      </PaneFrame>
    );
  }

  const canStart = STARTABLE_STATUSES.includes(agent.status);
  return (
    <PaneFrame
      id="live-terminal-pane"
      bodyId="nova-terminal-body"
      title={agent.name}
      location="no shell"
      status={
        <span className="flex items-center gap-1" role="status" data-testid="terminal-status">
          <span className="w-1.5 h-1.5 rounded-full bg-outline" />
          {STATUS_LABEL[agent.status].toUpperCase()}
        </span>
      }
      actions={canStart ? null : actions}
      state={`agent-${agent.status}`}
      agentId={agent.id}
    >
      <PaneNotice>
        {canStart ? (
          <>
            <p>
              {agent.name} is {agent.status === "error" ? "in error" : "not running"}.
              {agent.status === "error" && " Its last shell failed or crashed."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("start")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              {pending === "start" ? "Starting…" : "Start Agent"}
            </button>
          </>
        ) : (
          <p>{STATUS_LABEL[agent.status]}…</p>
        )}
        {actionError && (
          <p role="alert" className="text-error">
            {actionError}
          </p>
        )}
      </PaneNotice>
    </PaneFrame>
  );
}

/**
 * A scratch shell for the developer, not owned by any agent (the PR 5 terminal): the
 * design's second pane. Leaving the page ends it; Restart starts a new one.
 */
export function DevShellPane() {
  const [status, setStatus] = useState<TerminalStatus>(INITIAL_STATUS);
  // Bumping the key remounts RealTerminal: a new socket and a fresh PTY.
  const [generation, setGeneration] = useState(0);
  return (
    <PaneFrame
      id="dev-shell-pane"
      bodyId="dev-shell-body"
      title={status.session ? shellName(status.session.shell) : "shell"}
      location={status.session ? status.session.cwd : "developer shell"}
      tooltip="Developer shell: not owned by an agent; closes when you leave this page"
      developer
      status={
        <span
          className="flex items-center gap-2 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary"
          data-terminal-session-badge
        >
          <ConnectionStatus status={status} />
        </span>
      }
      actions={
        isEnded(status.state) && (
          <button
            type="button"
            onClick={() => {
              setStatus(INITIAL_STATUS);
              setGeneration((value) => value + 1);
            }}
            className={LINK_BUTTON}
          >
            Restart
          </button>
        )
      }
      state={status.state}
    >
      <RealTerminal key={generation} onStatusChange={setStatus} />
    </PaneFrame>
  );
}
