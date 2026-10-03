// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.

export function StepWorkspace({ active }: { active: boolean }) {
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-4"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            {"Workspace Mounting & Memory Isolation"}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Map filesystems, dedicated vector memory, and inter-agent communication channels.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Working Directory Root
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-secondary flex items-center justify-between">
              <span className="truncate font-mono">/hyperion-core/distributed-mesh</span>
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
              <span className="truncate font-mono">Qdrant Local IPC (8 GB Cache)</span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary">
                PERSISTENT
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Swarm Inter-Agent IPC Channel
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-primary flex items-center justify-between">
              <span className="truncate font-mono">@kite (Hyperion Swarm IPC Bus)</span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                BROADCAST
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface">
              Sandbox Security Policy
            </label>
            <div className="p-2.5 bg-surface-container rounded-lg font-code-sm text-code-sm text-on-surface flex items-center justify-between">
              <span className="truncate font-mono">Enclave Tier 3 (Airgapped Read/Write)</span>
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
                Allow Kite to recruit sibling sub-agents for parallel unit testing.
              </div>
            </div>
          </div>
          <div className="w-10 h-6 bg-primary rounded-full p-1 flex items-center justify-end cursor-pointer">
            <div className="w-4 h-4 rounded-full bg-on-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}
