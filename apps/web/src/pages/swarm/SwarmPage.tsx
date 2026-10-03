// Ported from the Stitch export (agent_hive_swarm_command_center/code.html). Keep visually identical to the design.
import { OperativeTelemetryPanel } from "./OperativeTelemetryPanel";
import { SwarmHeader } from "./SwarmHeader";
import { SwarmMetrics } from "./SwarmMetrics";
import { SwarmOperatives } from "./SwarmOperatives";

export function SwarmPage() {
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full">
      <div className="flex flex-col w-full">
        <div className="relative w-full">
          <div className="absolute top-0 left-1/4 w-96 h-48 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />{" "}
          <div className="absolute top-12 right-1/3 w-80 h-40 bg-secondary/10 rounded-full blur-[90px] pointer-events-none -z-10" />{" "}
          <div className="flex w-full min-h-[calc(100vh-3rem)]">
            <section className="flex-1 min-w-0 p-margin-md lg:p-margin-lg flex flex-col gap-space-xl">
              <SwarmHeader />
              <SwarmMetrics />
              <SwarmOperatives />
              <section className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-secondary">
                      history
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface font-medium">
                      Swarm Transaction Feed
                    </span>
                  </div>
                  <span className="font-code-sm text-code-sm text-outline">Real-time sync</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/20 text-body-sm font-body-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-primary/20 text-primary-fixed border border-primary/30">
                        @Nova
                      </span>
                      <span className="text-on-surface font-code-sm text-code-sm">
                        pushed commit{" "}
                        <code className="text-secondary bg-surface-container-highest px-1 rounded">
                          b8f3a91
                        </code>{" "}
                        to feature/agents-grid
                      </span>
                    </div>
                    <span className="font-code-sm text-code-sm text-outline">2m ago</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/20 text-body-sm font-body-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-tertiary-container/30 text-tertiary-fixed border border-tertiary/30">
                        @Scout
                      </span>
                      <span className="text-on-surface font-code-sm text-code-sm">
                        initiated automated regression run{" "}
                        <span className="text-on-surface font-semibold">#1049</span> against staging
                      </span>
                    </div>
                    <span className="font-code-sm text-code-sm text-outline">4m ago</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/20 text-body-sm font-body-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-primary-container/30 text-primary-fixed-dim border border-primary-container/30">
                        @Michael
                      </span>
                      <span className="text-on-surface font-code-sm text-code-sm">
                        delegated redis latency patch to{" "}
                        <strong className="text-secondary">@Atlas</strong> (High Priority #12)
                      </span>
                    </div>
                    <span className="font-code-sm text-code-sm text-outline">7m ago</span>
                  </div>
                </div>
              </section>
            </section>
            <OperativeTelemetryPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
