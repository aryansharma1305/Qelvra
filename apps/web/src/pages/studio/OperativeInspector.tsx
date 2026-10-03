// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.
import { STUDIO_OPERATIVES, type OperativeKey } from "./studioOperatives";

// Name, role and desk follow the selected operative; the remaining telemetry is design mock data.
export function OperativeInspector({ operative }: { operative: OperativeKey }) {
  const details = STUDIO_OPERATIVES[operative];
  return (
    <div
      className="w-full xl:w-96 bg-surface-container-low flex flex-col justify-between shrink-0"
      id="agentInspector"
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
              Operative Telemetry
            </span>
            <span className="font-code-sm text-code-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded">
              OP-01
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-label-sm text-label-sm text-tertiary">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            ACTIVE DESK
          </span>
        </div>
        <div className="flex items-start gap-3.5 bg-surface-container p-3.5 rounded-xl">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[26px]">terminal</span>
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-secondary ring-2 ring-surface-container" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h2
                className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate"
                id="inspectorName"
              >
                {details.name}
              </h2>
              <span
                className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-secondary"
                id="inspectorRoleTag"
              >
                {details.role}
              </span>
            </div>
            <p
              className="font-body-sm text-body-sm text-on-surface-variant truncate"
              id="inspectorDesk"
            >
              {details.desk}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-code-sm text-code-sm text-outline">Model:</span>
              <span className="font-code-sm text-code-sm text-on-surface">
                Claude 3.5 Sonnet (4-bit)
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-container p-3.5 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-outline font-label-sm text-label-sm">
            <span className="uppercase tracking-wider">Current Execution Node</span>
            <span className="text-secondary font-code-sm">PID: 90284</span>
          </div>
          <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col gap-1.5 font-code-sm text-code-sm">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
              <span className="font-medium">ast_grep.refactor_syntax</span>
            </div>
            <p className="text-on-surface-variant text-[11px] leading-tight font-body-sm truncate">
              Migrating legacy React 18 state transitions to Signals DAG graph
            </p>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex justify-between font-code-sm text-code-sm text-on-surface-variant">
              <span>Task Progress (#TSK-8924)</span>
              <span className="text-secondary font-medium">72%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[72%] transition-all duration-500" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-surface-container p-3 rounded-lg flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase">Node VRAM</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-0.5">
              4.8 GB
            </span>
            <span className="font-code-sm text-code-sm text-tertiary mt-0.5">
              Optimal / LoRA 0.4
            </span>
          </div>
          <div className="bg-surface-container p-3 rounded-lg flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Local Latency
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-0.5">
              38 ms
            </span>
            <span className="font-code-sm text-code-sm text-secondary mt-0.5">92 tokens/sec</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Quick Interventions
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px] text-secondary">
                notifications_active
              </span>
              <span>Ping Desk</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px] text-outline">
                pause_circle
              </span>
              <span>Pause Task</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px] text-primary">local_cafe</span>
              <span>Send Beverage</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px]">terminal</span>
              <span>Inspect (⌘T)</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Live Desk Activity Ticker
            </span>
            <span className="font-code-sm text-code-sm text-tertiary">Realtime</span>
          </div>
          <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1" id="tickerContainer">
            <div className="bg-surface-container/60 p-2 rounded text-[11px] font-code-sm flex items-start gap-2">
              <span className="text-outline">16:42:01</span>
              <span className="text-primary font-medium">Michael</span>
              <span className="text-on-surface-variant">
                Dispatched DAG slice to Nova (#TSK-8924)
              </span>
            </div>
            <div className="bg-surface-container/60 p-2 rounded text-[11px] font-code-sm flex items-start gap-2">
              <span className="text-outline">16:41:48</span>
              <span className="text-secondary font-medium">Nova</span>
              <span className="text-on-surface-variant">
                Completed AST parse pass 1 (0 err, 14 warnings)
              </span>
            </div>
            <div className="bg-surface-container/60 p-2 rounded text-[11px] font-code-sm flex items-start gap-2">
              <span className="text-outline">16:40:12</span>
              <span className="text-tertiary font-medium">Scout</span>
              <span className="text-on-surface-variant">
                Playwright fuzz test suite completed: 184 passing
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 bg-surface-container-lowest flex items-center justify-between font-label-sm text-label-sm text-outline">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-tertiary">memory</span>
          vLLM Engine: 0.6.3 Local
        </span>
        <button className="hover:text-on-surface transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">tune</span>
          <span>Audio Desk</span>
        </button>
      </div>
    </div>
  );
}
