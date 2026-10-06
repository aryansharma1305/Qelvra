// Ported from the Stitch export (agent_hive_multi_agent_terminal_workspace/code.html). Keep visually identical to the design.

export function AgentContextPanel() {
  return (
    <div className="xl:col-span-4 flex flex-col gap-3">
      <div className="p-4 rounded-xl bg-surface-container-low shadow-md flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                alt="Preview Agent Avatar"
                className="w-10 h-10 rounded-lg object-cover ring-1 ring-primary/40 shadow-sm"
                src="/artwork/avatar-user.svg"
              />{" "}
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-secondary ring-2 ring-surface-container-low flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-on-secondary" />
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  Preview
                </span>
                <span className="font-label-sm text-label-sm px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                  OP-01
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-outline">
                Context panel — coming later
              </span>
            </div>
          </div>
          <button
            disabled
            aria-label="dock to right — coming later"
            className="p-1 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
            title="Toggle telemetry panel"
            type="button"
          >
            {" "}
            <span className="material-symbols-outlined text-[18px]">dock_to_right</span>{" "}
          </button>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-lowest flex flex-col gap-2">
          <div className="flex items-center justify-between font-label-sm text-label-sm">
            <span className="text-outline uppercase tracking-wider">Active Mission</span>
            <span className="text-primary font-medium">Not measured</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface font-medium leading-snug">
            {"Redesign dashboard navigation hierarchy & inject live telemetry overlay"}
          </p>
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              style={{ width: "0%" }}
            />
          </div>
          <div className="flex justify-between items-center font-code-sm text-code-sm text-outline pt-1">
            <span>Phase: AST Mutation</span>
            <span>ETA: not measured</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline uppercase tracking-wider">
            <span>Recent Tool Actions</span>
            <span className="text-tertiary">Not available yet</span>
          </div>
          <div className="space-y-1.5 font-code-sm text-code-sm">
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-tertiary">
                  check_circle
                </span>
                <span className="text-on-surface">ast_grep.refactor</span>
              </div>
              <span className="text-outline">Not measured</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  edit_note
                </span>
                <span className="text-on-surface">file_system.write</span>
              </div>
              <span className="text-outline">Not measured</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-primary">commit</span>
                <span className="text-on-surface">git.commit_push</span>
              </div>
              <span className="text-outline">Not measured</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline uppercase tracking-wider">
            <span>Files — coming later</span>
            <span className="text-secondary font-mono">Not measured</span>
          </div>
          <div className="space-y-1 font-code-sm text-code-sm">
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-[14px] text-primary">
                  description
                </span>
                <span className="truncate text-on-surface">NavigationRail.tsx</span>
              </div>
              <span className="text-tertiary text-label-sm font-label-sm">Not measured</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  data_object
                </span>
                <span className="truncate text-on-surface">tokens.json</span>
              </div>
              <span className="text-secondary text-label-sm font-label-sm">Not measured</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-[14px] text-tertiary">
                  javascript
                </span>
                <span className="truncate text-on-surface">useKeyCommand.ts</span>
              </div>
              <span className="text-tertiary text-label-sm font-label-sm">Not measured</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline uppercase tracking-wider">
            <span>Inter-Agent IPC Feed</span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          </div>
          <div className="p-2.5 rounded-lg bg-surface-container-lowest space-y-2 font-code-sm text-code-sm">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-label-sm font-label-sm">
                <span className="text-primary font-semibold">Michael (Orchestrator)</span>
                <span className="text-outline">Not measured</span>
              </div>
              <p className="text-on-surface-variant text-body-sm font-body-sm">Not measured</p>
            </div>
            <div className="h-px bg-surface-container-high" />
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-label-sm font-label-sm">
                <span className="text-secondary font-semibold">Preview (Frontend)</span>
                <span className="text-outline">Not measured</span>
              </div>
              <p className="text-on-surface-variant text-body-sm font-body-sm">
                Applied <code className="text-primary">will-change: transform</code>Not measured
              </p>
            </div>
            <div className="h-px bg-surface-container-high" />
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-label-sm font-label-sm">
                <span className="text-tertiary font-semibold">Scout (QA Lead)</span>
                <span className="text-outline">Not measured</span>
              </div>
              <p className="text-on-surface-variant text-body-sm font-body-sm">
                {
                  "@Preview, sub-pixel blur glitch detected on Safari WebKit > 20px blur radius. Patch queued."
                }
              </p>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-lowest flex flex-col gap-2">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
            <span className="uppercase">Node Hardware Telemetry</span>
            <span className="text-tertiary font-code-sm text-code-sm">Not measured</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-code-sm text-code-sm">
            <div className="p-2 rounded bg-surface-container flex flex-col gap-1">
              <span className="text-outline font-label-sm text-label-sm">GPU Accelerator</span>
              <span className="text-on-surface font-semibold">Not measured</span>
              <span className="text-secondary text-label-sm font-label-sm">Not measured</span>
            </div>
            <div className="p-2 rounded bg-surface-container flex flex-col gap-1">
              <span className="text-outline font-label-sm text-label-sm">VRAM Allocation</span>
              <span className="text-on-surface font-semibold">Not measured</span>
              <span className="text-tertiary text-label-sm font-label-sm">Not measured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
