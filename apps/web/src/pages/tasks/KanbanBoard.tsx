// Ported from the Stitch export (agent_hive_mission_control/code.html). Keep visually identical to the design.
import { ASSIGNED_TASKS, COMPLETED_TASKS, INBOX_TASKS, REVIEW_TASKS } from "../../mocks/tasks";
import { AssignedTaskCard, CompletedTaskCard, InboxTaskCard, ReviewTaskCard } from "./TaskCards";

interface KanbanBoardProps {
  onSelectedTaskClick: () => void;
}

export function KanbanBoard({ onSelectedTaskClick }: KanbanBoardProps) {
  return (
    <div className="flex-1 overflow-x-auto p-6 transition-all duration-300" id="kanban-canvas">
      <div className="flex items-start gap-4 min-w-[1240px]">
        <InboxColumn />
        <AssignedColumn />
        <WorkingColumn onSelectedTaskClick={onSelectedTaskClick} />
        <ReviewColumn />
        <CompletedColumn />
      </div>
    </div>
  );
}

function InboxColumn() {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-xl bg-surface-container-lowest/60 border border-outline-variant/20 max-h-[calc(100vh-16rem)]">
      <div className="p-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-outline" />
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Inbox
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant border border-outline-variant/30">
            {INBOX_TASKS.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors"
            title="Quick Add"
          >
            {" "}
            <span className="material-symbols-outlined text-[16px]">add</span>{" "}
          </button>
          <button className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors">
            {" "}
            <span className="material-symbols-outlined text-[16px]">more_horiz</span>{" "}
          </button>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        {INBOX_TASKS.map((task) => (
          <InboxTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function AssignedColumn() {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-xl bg-surface-container-lowest/60 border border-outline-variant/20 max-h-[calc(100vh-16rem)]">
      <div className="p-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary/70" />
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Assigned
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant border border-outline-variant/30">
            {ASSIGNED_TASKS.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors">
            {" "}
            <span className="material-symbols-outlined text-[16px]">add</span>{" "}
          </button>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        {ASSIGNED_TASKS.map((task) => (
          <AssignedTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function WorkingColumn({ onSelectedTaskClick }: KanbanBoardProps) {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-xl bg-surface-container-lowest/70 border border-secondary/30 shadow-[0_0_24px_rgba(76,215,246,0.06)] max-h-[calc(100vh-16rem)]">
      <div className="p-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/80 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
          </span>
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Working
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 font-semibold">
            3
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-mono">
          Live Loop
        </span>
      </div>
      <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        <div
          className="p-3.5 rounded-lg bg-surface-container-high border-2 border-secondary/80 shadow-[0_0_16px_rgba(76,215,246,0.18)] transition-all cursor-pointer relative"
          id="selected-card"
          role="button"
          tabIndex={0}
          onClick={onSelectedTaskClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectedTaskClick();
            }
          }}
        >
          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold uppercase tracking-wider flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-on-secondary animate-ping" />
            Inspecting
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-code-sm text-code-sm text-secondary font-semibold">
              #TSK-8924
            </span>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-error-container/30 text-error border border-error/30 uppercase font-medium">
              High
            </span>
          </div>
          <h4 className="font-body-md text-body-md font-semibold text-on-surface leading-snug">
            {"Implement Login API & WebAuthn Session Bridge"}
          </h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">
            {"Writing JWT middleware & Redis rotation with FIDO2 passkey credentials attestation."}
          </p>
          <div className="mt-3 p-2 rounded bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center font-code-sm text-[10px] font-bold">
                  A
                </div>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Atlas</span>
                <span className="font-label-sm text-label-sm text-outline">GPT-4o</span>
              </div>
              <span className="font-code-sm text-code-sm text-secondary font-medium">72%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-secondary w-[72%] transition-all" />
            </div>
            <div className="font-code-sm text-[10px] text-outline truncate flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[12px] text-secondary">terminal</span>
              <span>{"atlas: Added JWT middleware & Redis rotation"}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-outline font-label-sm text-label-sm">
            <span className="flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[13px] text-secondary">timer</span>
              18m 45s run
            </span>
            <span className="text-tertiary flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">check</span>
              4/5 tests pass
            </span>
          </div>
        </div>
        <div className="group p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-secondary/50 hover:bg-surface-container transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="font-code-sm text-code-sm text-outline group-hover:text-secondary transition-colors">
              #TSK-8925
            </span>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20 uppercase font-medium">
              Med
            </span>
          </div>
          <h4 className="font-body-md text-body-md font-medium text-on-surface leading-snug">
            Refactor Mobile Nav Drawer AST with Headless UI
          </h4>
          <p className="font-body-sm text-body-sm text-outline mt-1 line-clamp-2">
            Replacing legacy accordion state machine with polymorphic CSS transform transitions.
          </p>
          <div className="mt-3 p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-code-sm text-[10px] font-bold">
                  N
                </div>
                <span className="font-body-sm text-body-sm text-on-surface">Nova</span>
              </div>
              <span className="font-code-sm text-code-sm text-secondary">45%</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[45%]" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-outline font-label-sm text-label-sm">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">timer</span>
              34m
            </span>
            <span className="text-outline">Nova: "Refactoring AST for mobile nav"</span>
          </div>
        </div>
        <div className="group p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-secondary/50 hover:bg-surface-container transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="font-code-sm text-code-sm text-outline group-hover:text-secondary transition-colors">
              #TSK-8926
            </span>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-highest text-outline uppercase font-medium">
              Low
            </span>
          </div>
          <h4 className="font-body-md text-body-md font-medium text-on-surface leading-snug">
            Canvas Ray-tracing WebGL shader memory profiling
          </h4>
          <div className="mt-3 p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-tertiary/20 text-tertiary flex items-center justify-center font-code-sm text-[10px] font-bold">
                P
              </div>
              <span className="font-body-sm text-body-sm text-on-surface">Pixel</span>
            </div>
            <span className="font-code-sm text-code-sm text-tertiary">90%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewColumn() {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-xl bg-surface-container-lowest/60 border border-outline-variant/20 max-h-[calc(100vh-16rem)]">
      <div className="p-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Review
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {REVIEW_TASKS.length}
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-outline uppercase font-mono">
          Sign-off
        </span>
      </div>
      <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        {REVIEW_TASKS.map((task) => (
          <ReviewTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function CompletedColumn() {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-xl bg-surface-container-lowest/60 border border-outline-variant/20 max-h-[calc(100vh-16rem)]">
      <div className="p-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tertiary" />
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Completed
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary border border-tertiary/30">
            {COMPLETED_TASKS.length}
          </span>
        </div>
        <span className="material-symbols-outlined text-[16px] text-tertiary">done_all</span>
      </div>
      <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        {COMPLETED_TASKS.map((task) => (
          <CompletedTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
