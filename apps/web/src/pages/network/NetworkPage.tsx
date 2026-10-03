// Ported from the Stitch export (agent_hive_agent_network/code.html). Keep visually identical to the design.
import { IpcTimeline } from "./IpcTimeline";
import { MeshGraph } from "./MeshGraph";
import { NetworkHeader } from "./NetworkHeader";
import { NodeTelemetryPanel } from "./NodeTelemetryPanel";

export function NetworkPage() {
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full">
      <div className="flex flex-col w-full">
        <NetworkHeader />
        <div
          className="relative w-full flex flex-col lg:flex-row flex-1 overflow-hidden"
          style={{ minHeight: "calc(100vh - 120px)" }}
        >
          <MeshGraph />
          <NodeTelemetryPanel />
        </div>
        <IpcTimeline />
      </div>
    </main>
  );
}
