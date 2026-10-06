// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import { ZOOM_DEFAULT } from "./studioOperatives";

const VIEW_ACTIVE =
  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-primary/20 text-primary shadow-sm";
const VIEW_INACTIVE =
  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant disabled:opacity-50 cursor-not-allowed";
const PERSPECTIVE_ACTIVE =
  "px-2.5 py-1 rounded font-code-sm text-code-sm text-secondary bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const PERSPECTIVE_INACTIVE =
  "px-2.5 py-1 rounded font-code-sm text-code-sm text-on-surface-variant disabled:opacity-50 cursor-not-allowed";
const ZOOM_STEP = 10;

interface StudioToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function StudioToolbar({ zoom, onZoomChange }: StudioToolbarProps) {
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
          className={VIEW_ACTIVE}
          id="viewBtnStudio"
          type="button"
          disabled
          aria-label="Studio View — fixed visual preview"
          title="The beta provides a fixed Studio preview."
        >
          <span className="material-symbols-outlined text-[15px]">deployed_code</span>
          <span>Studio View</span>
        </button>
        <button
          className={VIEW_INACTIVE}
          id="viewBtnCommand"
          type="button"
          disabled
          aria-label="Command View — coming later"
          title="Command View is planned for a future release."
        >
          <span className="material-symbols-outlined text-[15px]">grid_view</span>
          <span>Command View</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
          <button
            className={PERSPECTIVE_ACTIVE}
            id="perspIso"
            type="button"
            disabled
            aria-label="Isometric 3D — fixed visual preview"
            title="The Studio preview uses a fixed isometric drawing."
          >
            Isometric 3D
          </button>
          <button
            className={PERSPECTIVE_INACTIVE}
            id="perspOrtho"
            type="button"
            disabled
            aria-label="Plan 2D — coming later"
            title="A top-down Plan 2D view is planned for a future release."
          >
            Plan 2D
          </button>
        </div>
        <div className="flex items-center bg-surface-container-low rounded-lg px-1.5 py-1 gap-1">
          <button
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
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
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
            type="button"
            onClick={() => onZoomChange(zoom + ZOOM_STEP)}
          >
            {" "}
            <span className="material-symbols-outlined text-[15px]">add</span>{" "}
          </button>
          <button
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Reset Zoom"
            aria-label="Reset Zoom"
            type="button"
            onClick={() => onZoomChange(ZOOM_DEFAULT)}
          >
            {" "}
            <span className="material-symbols-outlined text-[15px]">crop_free</span>{" "}
          </button>
        </div>
        <div
          aria-label="Decorative atmosphere: Midnight Pulse"
          className="hidden lg:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg"
        >
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
