// Ported from the Stitch export (agent_hive_swarm_command_center/code.html). Keep visually identical to the design.
import { SWARM_OPERATIVES } from "../../mocks/agents";
import { SwarmOperativeCard } from "./SwarmOperativeCard";

export function SwarmOperatives() {
  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">group_work</span>
          <h2 className="font-headline-sm text-headline-sm font-medium text-on-surface">
            Active Swarm Operatives
          </h2>
          <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
            Preview cards
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
          Auto-orchestration loop locked
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
        {SWARM_OPERATIVES.map((operative) => (
          <SwarmOperativeCard key={operative.id} operative={operative} />
        ))}
      </div>
    </section>
  );
}
