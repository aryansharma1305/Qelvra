// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.
import { useServerHealth } from "../../hooks/useServerHealth";
import { useNavigate } from "react-router";
import { useAgents } from "../../features/agents/agents-store";
import { ACTIVE_STATUSES } from "../../features/agents/presentation";
import { useLinkBehavior } from "../../hooks/useLinkBehavior";

// The workspace name and the profile are design mock data; the agent count is real.
export function AppHeader() {
  const { agents, status } = useAgents();
  const connection = useServerHealth();
  const active = agents.filter((agent) => ACTIVE_STATUSES.includes(agent.status)).length;
  const navigate = useNavigate();
  const homeLink = useLinkBehavior("/");
  const swarmLink = useLinkBehavior("/agents");

  return (
    <header className="fixed top-0 left-0 right-0 h-12 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center px-4 justify-between">
      <div className="flex items-center gap-space-md">
        <img
          {...homeLink}
          alt="Qelvra Brand Mark"
          className="h-6 w-auto object-contain"
          src="/artwork/qelvra-mark.svg"
        />
        <div className="flex items-center gap-space-xs">
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            Qelvra
          </span>
          <span className="font-label-sm text-label-sm bg-surface-container-high text-primary px-1.5 py-0.5 rounded border border-outline-variant/40 uppercase">
            v0.1.0-beta.1
          </span>
        </div>
        <div className="h-4 w-px bg-outline-variant/30 mx-1" />
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/30 text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-secondary">hub</span>
          <span className="font-code-sm text-code-sm font-medium">Local workspace</span>
        </div>
        <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/20 font-label-sm text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[13px] text-tertiary">commit</span>
          <span>Git: not measured</span>
        </div>
      </div>
      <div className="hidden xl:block flex-1 max-w-lg mx-6">
        <button
          disabled
          title="Coming later — this control is not available in the beta"
          aria-label="search — coming later"
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/40 hover:border-primary/50 text-on-surface-variant transition-all"
          type="button"
        >
          <div className="hidden sm:flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-outline">search</span>
            <span className="font-body-sm text-body-sm text-outline">Search — coming later</span>
          </div>
          <kbd className="font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant border border-outline-variant/50 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-space-md">
        <div
          {...swarmLink}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container-low border border-tertiary-container/30"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
          </span>
          <span className="font-code-sm text-code-sm text-tertiary-fixed">
            {status === "ready" && connection.state === "connected"
              ? `${active} ${active === 1 ? "Agent" : "Agents"} Active`
              : "Agents unavailable"}
          </span>
        </div>
        <button
          aria-label="Open Activity"
          onClick={() => navigate("/activity")}
          className="relative p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-secondary" />
        </button>
        <button
          disabled
          title="Coming later — this control is not available in the beta"
          aria-label="graphic eq — coming later"
          className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
        </button>
        <button
          aria-label="Open Settings"
          onClick={() => navigate("/settings")}
          className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>
        <div className="h-4 w-px bg-outline-variant/30" />
        <div className="flex items-center gap-2">
          <img
            alt="Preview profile"
            className="w-7 h-7 rounded-full object-cover ring-1 ring-outline-variant/40"
            src="/artwork/avatar-user.svg"
          />
        </div>
      </div>
    </header>
  );
}
