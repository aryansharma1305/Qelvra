// Ported from the Stitch export (agent_hive_multi_agent_terminal_workspace/code.html). Keep visually identical to the design.
import type { FormEvent } from "react";

export function CommandBar() {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Steering is intentionally unavailable; live input belongs to the terminal panes.
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low shadow-lg">
      <div className="flex items-center justify-between text-outline font-label-sm text-label-sm px-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-primary">terminal</span>
          <span>{"Steering — coming later; type directly in the terminal above"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Target: <strong className="text-primary font-medium">Not available yet</strong>
          </span>
          <span className="text-outline-variant">|</span>
          <kbd className="px-1.5 py-0.2 rounded bg-surface-container text-outline">
            Coming later
          </kbd>
        </div>
      </div>
      <form className="flex items-center gap-2" id="terminal-command-form" onSubmit={onSubmit}>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="font-code-sm text-code-sm text-primary font-semibold select-none">
            terminal:~$
          </span>
          <input
            className="w-full bg-transparent font-code-sm text-code-sm text-on-surface placeholder:text-outline focus:outline-none"
            id="terminal-input"
            placeholder="Steering is not available yet"
            type="text"
            disabled
            aria-label="Steering — coming later"
            value=""
          />
        </div>
        <button
          disabled
          title="Coming later — this control is not available in the beta"
          aria-label="subdirectory arrow left — coming later"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm font-medium hover:bg-primary-container transition-all shadow-md active:scale-95"
          type="submit"
        >
          <span>Execute</span>
          <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_left</span>
        </button>
      </form>
      <div className="flex items-center justify-between px-1 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-label-sm text-label-sm text-outline">Quick prompts:</span>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
            type="button"
          >
            {" "}
            Revert last AST{" "}
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
            type="button"
          >
            {" "}
            Analyze chunks{" "}
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
            type="button"
          >
            {" "}
            Fix WebKit blur{" "}
          </button>
        </div>
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
          <span>Steering: Not available yet</span>
        </div>
      </div>
    </div>
  );
}
