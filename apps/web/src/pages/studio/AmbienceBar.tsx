// Ported from the Stitch export (agent_hive_ai_studio/code.html). Keep visually identical to the design.

export function AmbienceBar() {
  return (
    <div className="min-h-12 py-2 bg-surface-container-lowest px-6 flex flex-wrap items-center justify-between gap-4 font-code-sm text-code-sm">
      <div className="flex items-center gap-3">
        <button
          disabled
          aria-label="Play Studio audio — coming later"
          aria-describedby="studio-audio-help"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-high text-secondary disabled:opacity-50 cursor-not-allowed"
          id="playAudioBtn"
          title="Audio playback is planned for a future release."
        >
          <span className="material-symbols-outlined text-[16px]" id="playAudioIcon">
            play_arrow
          </span>
        </button>
        <p id="studio-audio-help" className="sr-only">
          Audio playback and volume are planned for a future release.
        </p>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary">equalizer</span>
          <span className="text-on-surface">Lo-Fi Focus Beats</span>
          <span className="text-outline font-label-sm text-label-sm">(Swarm Frequency 432Hz)</span>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-2">
          <span className="material-symbols-outlined text-[14px] text-outline">volume_down</span>
          <input
            disabled
            aria-label="Studio volume — coming later"
            aria-describedby="studio-audio-help"
            title="Volume is unavailable until audio playback is implemented."
            className="w-20 h-1 bg-surface-container-highest accent-secondary cursor-not-allowed rounded-full"
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
            Studio Env: <strong className="text-on-surface">Not measured</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-secondary">air</span>
          <span>
            Chamber Airflow: <strong className="text-tertiary">Not measured</strong>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-primary">savings</span>
          <span>
            Run Cost: <strong className="text-primary-fixed">Not measured</strong> (Hardware not
            measured)
          </span>
        </div>
      </div>
    </div>
  );
}
