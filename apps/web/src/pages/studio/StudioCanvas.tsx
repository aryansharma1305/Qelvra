// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import { ZOOM_DEFAULT, type OperativeKey, type Perspective } from "./studioOperatives";
import { IsometricScene } from "./IsometricScene";

const QUICK_PAN: readonly { key: OperativeKey; label: string; dot: string; activeText: string }[] =
  [
    { key: "michael", label: "Michael", dot: "bg-primary", activeText: "text-primary" },
    { key: "nova", label: "Nova", dot: "bg-secondary", activeText: "text-secondary" },
    { key: "scout", label: "Scout", dot: "bg-tertiary", activeText: "text-tertiary" },
  ];

interface StudioCanvasProps {
  zoom: number;
  perspective: Perspective;
  operative: OperativeKey;
  onSelectOperative: (operative: OperativeKey) => void;
}

export function StudioCanvas({
  zoom,
  perspective,
  operative,
  onSelectOperative,
}: StudioCanvasProps) {
  // Leave transform unset at the default view so the scene renders exactly as designed.
  const transform =
    zoom === ZOOM_DEFAULT && perspective === "iso"
      ? undefined
      : perspective === "ortho"
        ? `scale(${zoom / 100}) rotateX(0deg) rotateZ(0deg)`
        : `scale(${zoom / 100})`;

  return (
    <div
      className="flex-1 relative overflow-hidden flex items-center justify-center p-4 select-none bg-surface-container-lowest"
      id="canvasViewport"
      style={{ minHeight: "640px" }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(139,92,246,0.08),rgba(19,19,21,0))]" />
      <div className="absolute top-6 left-6 pointer-events-none flex flex-col gap-1 z-10">
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-primary">view_in_ar</span>
          <span>HYPERION_SWARM_OFFICE // SECTOR-07</span>
        </div>
        <span className="font-label-sm text-label-sm text-outline">Coordinates: not measured</span>
      </div>
      <div className="absolute top-6 right-6 z-10 hidden sm:flex items-center gap-2 bg-surface-container-low/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm font-label-sm text-label-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px] text-tertiary">check_circle</span>
        <span>
          Mesh Fabric: <strong className="text-tertiary">Healthy</strong>
        </span>
        <span className="text-outline">•</span>
        <span>
          IPC Bus: <strong className="text-secondary">Not measured</strong>
        </span>
      </div>
      <div
        className="relative transition-transform duration-300 ease-out flex items-center justify-center w-full max-w-[1080px] aspect-[16/10]"
        id="isometricScene"
        style={transform ? { transform } : undefined}
      >
        <IsometricScene onSelectOperative={onSelectOperative} />
      </div>
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-surface-container-low/90 backdrop-blur-md p-1.5 rounded-lg shadow-md">
        {QUICK_PAN.map(({ key, label, dot, activeText }) => (
          <button
            key={key}
            className={
              operative === key
                ? `px-2.5 py-1 rounded bg-surface-container-high text-xs font-code-sm ${activeText} transition-colors flex items-center gap-1.5`
                : "px-2.5 py-1 rounded hover:bg-surface-container-high text-xs font-code-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5"
            }
            type="button"
            aria-pressed={operative === key}
            onClick={() => onSelectOperative(key)}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-outline-variant/30 mx-0.5" />
        <button
          disabled
          aria-label="cell tower — coming later"
          className="px-2 py-1 rounded hover:bg-surface-container-high text-xs font-code-sm text-primary flex items-center gap-1 transition-colors"
          title="Swarm Broadcast"
        >
          <span className="material-symbols-outlined text-[14px]">cell_tower</span>
          <span>Broadcast</span>
        </button>
      </div>
    </div>
  );
}
