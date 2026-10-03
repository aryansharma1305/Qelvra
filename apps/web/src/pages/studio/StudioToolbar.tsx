// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import { ZOOM_DEFAULT, type Perspective, type StudioView } from "./studioOperatives";

const VIEW_ACTIVE =
  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-all bg-primary/20 text-primary shadow-sm";
const VIEW_INACTIVE =
  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all";
const PERSPECTIVE_ACTIVE =
  "px-2.5 py-1 rounded font-code-sm text-code-sm text-secondary bg-surface-container-high transition-colors";
const PERSPECTIVE_INACTIVE =
  "px-2.5 py-1 rounded font-code-sm text-code-sm text-on-surface-variant hover:text-on-surface transition-colors";
const ZOOM_STEP = 10;

interface StudioToolbarProps {
  view: StudioView;
  onViewChange: (view: StudioView) => void;
  perspective: Perspective;
  onPerspectiveChange: (perspective: Perspective) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

// TODO: "Command View" has no separate design yet; the toggle only switches state.
export function StudioToolbar({
  view,
  onViewChange,
  perspective,
  onPerspectiveChange,
  zoom,
  onZoomChange,
}: StudioToolbarProps) {
  return (
    <div className="px-6 py-4 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            AI Studio — Swarm Office
          </h1>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Spatial Sim v2.4
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
          Visual spatial simulation of local multi-agent autonomous runtime on Hyperion node
        </p>
      </div>
      <div className="flex items-center bg-surface-container-low p-1 rounded-full">
        <button
          className={view === "studio" ? VIEW_ACTIVE : VIEW_INACTIVE}
          id="viewBtnStudio"
          type="button"
          aria-pressed={view === "studio"}
          onClick={() => onViewChange("studio")}
        >
          <span className="material-symbols-outlined text-[15px]">deployed_code</span>
          <span>Studio View</span>
        </button>
        <button
          className={view === "command" ? VIEW_ACTIVE : VIEW_INACTIVE}
          id="viewBtnCommand"
          type="button"
          aria-pressed={view === "command"}
          onClick={() => onViewChange("command")}
        >
          <span className="material-symbols-outlined text-[15px]">grid_view</span>
          <span>Command View</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
          <button
            className={perspective === "iso" ? PERSPECTIVE_ACTIVE : PERSPECTIVE_INACTIVE}
            id="perspIso"
            type="button"
            aria-pressed={perspective === "iso"}
            onClick={() => onPerspectiveChange("iso")}
          >
            Isometric 3D
          </button>
          <button
            className={perspective === "ortho" ? PERSPECTIVE_ACTIVE : PERSPECTIVE_INACTIVE}
            id="perspOrtho"
            type="button"
            aria-pressed={perspective === "ortho"}
            onClick={() => onPerspectiveChange("ortho")}
          >
            Plan 2D
          </button>
        </div>
        <div className="flex items-center bg-surface-container-low rounded-lg px-1.5 py-1 gap-1">
          <button
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high transition-colors"
            title="Zoom Out"
            type="button"
            onClick={() => onZoomChange(zoom - ZOOM_STEP)}
          >
            {" "}
            <span className="material-symbols-outlined text-[15px]">remove</span>{" "}
          </button>
          <span
            className="font-code-sm text-code-sm text-on-surface px-1 min-w-[42px] text-center"
            id="zoomLevelDisplay"
          >
            {zoom}%
          </span>
          <button
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high transition-colors"
            title="Zoom In"
            type="button"
            onClick={() => onZoomChange(zoom + ZOOM_STEP)}
          >
            {" "}
            <span className="material-symbols-outlined text-[15px]">add</span>{" "}
          </button>
          <button
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high transition-colors"
            title="Fit to bounds"
            type="button"
            onClick={() => onZoomChange(ZOOM_DEFAULT)}
          >
            {" "}
            <span className="material-symbols-outlined text-[15px]">crop_free</span>{" "}
          </button>
        </div>
        <div className="hidden lg:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant leading-none">
              Atmosphere
            </span>
            <span className="font-code-sm text-code-sm text-on-surface leading-tight">
              Midnight Pulse
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
