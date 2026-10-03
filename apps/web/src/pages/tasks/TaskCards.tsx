import type {
  AssignedTaskMock,
  CompletedTaskMock,
  InboxTaskMock,
  ReviewTaskMock,
} from "../../mocks/tasks";

// Kanban card designs from the Stitch Mission Control screen, one per column style.

export function InboxTaskCard({ task }: { task: InboxTaskMock }) {
  return (
    <div
      className={`group p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant/80 hover:bg-surface-container transition-all cursor-pointer ${task.tone.card}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-code-sm text-code-sm text-outline group-hover:text-primary transition-colors">
          {task.id}
        </span>
        <span
          className={`font-label-sm text-label-sm px-2 py-0.5 rounded uppercase font-medium ${task.tone.priority}`}
        >
          {task.priority}
        </span>
      </div>
      <h4 className="font-body-md text-body-md font-medium text-on-surface leading-snug">
        {task.title}
      </h4>
      {task.description && (
        <p className="font-body-sm text-body-sm text-outline mt-1.5 line-clamp-2">
          {task.description}
        </p>
      )}
      {task.footer}
    </div>
  );
}

export function AssignedTaskCard({ task }: { task: AssignedTaskMock }) {
  return (
    <div className="group p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <span className="font-code-sm text-code-sm text-outline group-hover:text-primary transition-colors">
          {task.id}
        </span>
        <span
          className={`font-label-sm text-label-sm px-2 py-0.5 rounded border uppercase font-medium ${task.tone.priority}`}
        >
          {task.priority}
        </span>
      </div>
      <h4 className="font-body-md text-body-md font-medium text-on-surface leading-snug">
        {task.title}
      </h4>
      <p className="font-body-sm text-body-sm text-outline mt-1 line-clamp-2">{task.description}</p>
      <div className="mt-3 flex items-center justify-between p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20">
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center font-code-sm text-[10px] font-bold ${task.tone.assigneeAvatar}`}
          >
            {task.assigneeInitial}
          </div>
          <span className="font-body-sm text-body-sm text-on-surface">{task.assignee}</span>
        </div>
        {task.state}
      </div>
      {task.dependencies && (
        <div className="mt-2.5 flex items-center justify-between text-outline font-label-sm text-label-sm">
          <span>{task.dependencies.label}</span>
          <span className="text-on-surface-variant font-mono">{task.dependencies.steps}</span>
        </div>
      )}
    </div>
  );
}

export function ReviewTaskCard({ task }: { task: ReviewTaskMock }) {
  return (
    <div className="group p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-amber-400/50 hover:bg-surface-container transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <span className="font-code-sm text-code-sm text-outline group-hover:text-amber-300 transition-colors">
          {task.id}
        </span>
        <span
          className={`font-label-sm text-label-sm px-2 py-0.5 rounded border uppercase font-medium ${task.tone.priority}`}
        >
          {task.priority}
        </span>
      </div>
      <h4 className="font-body-md text-body-md font-medium text-on-surface leading-snug">
        {task.title}
      </h4>
      {task.description && (
        <p className="font-body-sm text-body-sm text-outline mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      {task.reviewer && (
        <div className="mt-3 p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-code-sm text-[10px] font-bold">
              {task.reviewer.initial}
            </div>
            <span className="font-body-sm text-body-sm text-on-surface">{task.reviewer.name}</span>
          </div>
          <span className="font-label-sm text-label-sm text-amber-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">rate_review</span>
            {task.reviewer.status}
          </span>
        </div>
      )}
      <div
        className={`flex items-center justify-between text-outline font-label-sm text-label-sm ${task.tone.footer}`}
      >
        <span className={task.tone.footerLabel}>{task.footerLabel}</span>
        <span className={task.tone.footerStatus}>{task.footerStatus}</span>
      </div>
    </div>
  );
}

export function CompletedTaskCard({ task }: { task: CompletedTaskMock }) {
  return (
    <div className="p-3.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/20 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-code-sm text-code-sm text-outline">{task.id}</span>
        <span className="font-label-sm text-label-sm text-tertiary font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">check</span>
          Merged
        </span>
      </div>
      <h4 className="font-body-md text-body-md font-medium text-on-surface line-through decoration-outline">
        {task.title}
      </h4>
      <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-outline font-label-sm text-label-sm">
        <span>{task.meta}</span>
        <span className="text-outline">{task.reference}</span>
      </div>
    </div>
  );
}
