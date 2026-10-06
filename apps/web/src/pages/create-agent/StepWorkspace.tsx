// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.

export function StepWorkspace({ active }: { active: boolean }) {
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-4"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">{"Agent workspace"}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Qelvra creates a separate workspace for this agent. Memory settings and delegation
            controls are coming later.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Working Directory Root
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-secondary flex items-center justify-between">
              <span className="truncate font-mono">Created when you save this agent</span>
              <span className="material-symbols-outlined text-outline text-[16px] cursor-pointer">
                folder
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Episodic Vector Memory Enclave
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-tertiary flex items-center justify-between">
              <span className="truncate font-mono">Not available yet</span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary">
                COMING LATER
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Swarm Inter-Agent IPC Channel
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-primary flex items-center justify-between">
              <span className="truncate font-mono">Agent mailbox (created on save)</span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                MAILBOX
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Workspace permissions
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-on-surface flex items-center justify-between">
              <span className="truncate font-mono">Provider-owned; not an OS sandbox</span>
              <span className="material-symbols-outlined text-tertiary text-[16px]">
                verified_user
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-[24px]">hub</span>
            <div>
              <div className="font-headline-sm text-headline-sm text-on-surface">
                Autonomous Delegations
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">
                Coming later. Goals assign registered agents after you approve a plan.
              </div>
            </div>
          </div>
          <div
            role="switch"
            aria-label="Automatic delegation — coming later"
            aria-checked={false}
            aria-disabled={true}
            title="Coming later"
            className="w-10 h-6 bg-surface-container-high rounded-full p-1 flex items-center justify-start cursor-not-allowed"
          >
            <div className="w-4 h-4 rounded-full bg-on-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}
