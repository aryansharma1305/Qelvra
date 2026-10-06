// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import { useState } from "react";
import { ZOOM_DEFAULT, clampZoom, type OperativeKey } from "./studioOperatives";
import { AmbienceBar } from "./AmbienceBar";
import { OperativeInspector } from "./OperativeInspector";
import { StudioCanvas } from "./StudioCanvas";
import { StudioToolbar } from "./StudioToolbar";

const ZONES = [
  "All Zones (6)",
  "Orchestration",
  "Engineering Bay (2)",
  "Creative Atelier",
  "QA & Security",
  "Lounge & Vault",
] as const;
const ZONE_INACTIVE = "zone-pill px-2.5 py-1 text-on-surface-variant text-xs";

export function StudioPage() {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [operative, setOperative] = useState<OperativeKey>("nova");

  return (
    <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
      <div className="flex flex-col w-full text-on-surface">
        <StudioToolbar zoom={zoom} onZoomChange={(next) => setZoom(clampZoom(next))} />
        <div className="px-6 py-2 bg-surface-container flex flex-wrap items-center justify-between gap-3 font-code-sm text-code-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mr-2">
              Sample zones:
            </span>
            {ZONES.map((label) => (
              <span
                key={label}
                className={ZONE_INACTIVE}
                title="Sample zone — filtering is planned for a future release."
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant font-label-md text-label-md">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Sample desks
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              Sample pod
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-outline" />
              Sample lounge
            </span>
          </div>
        </div>
        <div
          className="flex flex-col xl:flex-row flex-1 relative bg-surface-container-lowest overflow-hidden"
          style={{ minHeight: "calc(100vh - 180px)" }}
        >
          <StudioCanvas zoom={zoom} operative={operative} onSelectOperative={setOperative} />
          <OperativeInspector operative={operative} />
        </div>
        <AmbienceBar />
      </div>{" "}
    </main>
  );
}
