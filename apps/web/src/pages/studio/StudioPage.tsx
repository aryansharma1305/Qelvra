// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import { useState } from "react";
import {
  ZOOM_DEFAULT,
  clampZoom,
  type OperativeKey,
  type Perspective,
  type StudioView,
} from "./studioOperatives";
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
const ZONE_ACTIVE =
  "zone-pill active px-2.5 py-1 rounded bg-primary text-on-primary font-medium text-xs transition-colors";
const ZONE_INACTIVE =
  "zone-pill px-2.5 py-1 rounded bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs transition-colors";

export function StudioPage() {
  const [view, setView] = useState<StudioView>("studio");
  const [perspective, setPerspective] = useState<Perspective>("iso");
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [zone, setZone] = useState(0);
  const [operative, setOperative] = useState<OperativeKey>("nova");

  return (
    <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
      <div className="flex flex-col w-full text-on-surface">
        <StudioToolbar
          view={view}
          onViewChange={setView}
          perspective={perspective}
          onPerspectiveChange={setPerspective}
          zoom={zoom}
          onZoomChange={(next) => setZoom(clampZoom(next))}
        />
        <div className="px-6 py-2 bg-surface-container flex flex-wrap items-center justify-between gap-3 font-code-sm text-code-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mr-2">
              Zones:
            </span>
            {ZONES.map((label, index) => (
              <button
                key={label}
                className={zone === index ? ZONE_ACTIVE : ZONE_INACTIVE}
                type="button"
                aria-pressed={zone === index}
                onClick={() => setZone(index)}
              >
                {label}
              </button>
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
          <StudioCanvas
            zoom={zoom}
            perspective={perspective}
            operative={operative}
            onSelectOperative={setOperative}
          />
          <OperativeInspector operative={operative} />
        </div>
        <AmbienceBar />
      </div>{" "}
    </main>
  );
}
