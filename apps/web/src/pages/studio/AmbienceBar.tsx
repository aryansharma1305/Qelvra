// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.

export function AmbienceBar() {
  return (
    <div className="h-12 bg-surface-container-lowest px-6 flex flex-wrap items-center justify-between gap-4 font-code-sm text-code-sm">
      <div className="flex items-center gap-3">
        <button
          className="flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-secondary transition-colors"
          id="playAudioBtn"
          title="Play Studio Lo-Fi"
        >
          <span className="material-symbols-outlined text-[16px]" id="playAudioIcon">
            play_arrow
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary">equalizer</span>
          <span className="text-on-surface">Lo-Fi Focus Beats</span>
          <span className="text-outline font-label-sm text-label-sm">(Swarm Frequency 432Hz)</span>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-2">
          <span className="material-symbols-outlined text-[14px] text-outline">volume_down</span>
          <input
            className="w-20 h-1 bg-surface-container-highest accent-secondary cursor-pointer rounded-full"
            max="100"
            min="0"
            type="range"
            defaultValue="35"
          />
        </div>
      </div>
      <div className="flex items-center gap-6 text-on-surface-variant font-label-md text-label-md">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-tertiary">thermostat</span>
          <span>
            Studio Env: <strong className="text-on-surface">21°C</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-secondary">air</span>
          <span>
            Chamber Airflow: <strong className="text-tertiary">Optimal</strong>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-primary">savings</span>
          <span>
            Run Cost: <strong className="text-primary-fixed">$0.00</strong> (RTX 4090 Sovereign)
          </span>
        </div>
      </div>
    </div>
  );
}
