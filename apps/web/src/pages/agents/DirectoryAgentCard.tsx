import type { KeyboardEvent } from "react";
import { DirectoryAvatar } from "../../components/agents/DirectoryAvatar";
import type { DirectoryCardView } from "../../features/agents/presentation";

interface DirectoryAgentCardProps {
  agent: DirectoryCardView;
  onOpen: () => void;
  onInspect: () => void;
}

// One card from the Stitch directory design, rendering a real agent (see toDirectoryCard).
export function DirectoryAgentCard({ agent, onOpen, onInspect }: DirectoryAgentCardProps) {
  const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onCardKeyDown}
      className="agent-card group relative flex flex-col justify-between p-5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all duration-300 shadow-md hover:shadow-xl cursor-pointer"
      data-agent={agent.id}
      data-status={agent.status}
    >
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity ${agent.tone.glow}`}
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-lowest shadow-sm">
              <DirectoryAvatar agentId={agent.id} />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface-container-lowest flex items-center justify-center">
                <span className={`w-2.5 h-2.5 rounded-full ${agent.tone.presenceDot}`} />
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface tracking-tight group-hover:text-primary transition-colors">
                  {agent.name}
                </span>
                <span
                  className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded font-mono ${agent.tone.opIdBadge}`}
                >
                  {agent.opId}
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-outline">{agent.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium">
              <span className={`w-2 h-2 rounded-full ${agent.tone.modelDot}`} />
              <span>{agent.model}</span>
            </span>
            <button
              disabled
              aria-label="more vert — coming later"
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors"
              title="Options"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[16px]">more_vert</span>{" "}
            </button>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          {agent.bio}
        </p>
        <div
          className={`flex flex-col gap-2 p-3 rounded-xl bg-surface-container-lowest/80 shadow-xs ${agent.tone.activityPanel}`}
        >
          <div className="flex items-center justify-between font-label-sm text-label-sm">
            <span className={`flex items-center gap-1.5 ${agent.tone.status}`}>
              <span className={`w-2 h-2 rounded-full ${agent.tone.statusDot}`} />
              <span className="font-semibold uppercase tracking-wider">{agent.statusLabel}</span>
            </span>
            <span className={agent.tone.statusMeta}>{agent.statusMeta}</span>
          </div>
          <p className={`font-code-sm text-code-sm truncate ${agent.tone.task}`}>
            {agent.currentTask}
          </p>
          <div className="flex items-center justify-between text-outline font-label-sm text-label-sm pt-1">
            <span
              className={`flex items-center gap-1 truncate max-w-[190px] ${agent.tone.workspace}`}
            >
              <span className={`material-symbols-outlined text-[13px] ${agent.tone.workspaceIcon}`}>
                {agent.workspaceIcon}
              </span>
              <span>{agent.workspace}</span>
            </span>
            <span className={`font-mono ${agent.tone.lastActive}`}>{agent.lastActive}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center font-label-sm text-label-sm">
            <span className="text-outline uppercase tracking-wider">Context Window</span>
            <span className="font-mono text-on-surface-variant font-medium">
              {agent.contextUsage}{" "}
              <span className={agent.tone.contextPercent}>{agent.contextPercent}</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${agent.tone.contextBar}`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agent.skills.map((skill) => (
            <span
              key={skill}
              className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
      <div className="relative flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between pt-4 mt-2">
        <div className="flex items-center gap-1.5 text-outline font-label-sm text-label-sm">
          <span className={`material-symbols-outlined text-[14px] ${agent.tone.runtimeIcon}`}>
            {agent.runtimeIcon}
          </span>
          <span>{agent.runtime}</span>
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onInspect();
          }}
          className="btn-inspect flex items-center gap-1 text-primary hover:text-primary-fixed font-body-sm text-body-sm font-medium transition-colors"
          type="button"
          data-agent={agent.id}
        >
          <span>Inspect Profile</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
