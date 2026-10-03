// Ported from the Stitch export (agent_hive_multi_agent_terminal_workspace/code.html). Keep visually identical to the design.
import { useState, type FormEvent } from "react";

const QUICK_PROMPTS: Record<string, string> = {
  "Revert last AST": "Revert last AST modification",
  "Analyze chunks": "Run bundle analyzer and report chunk weights",
  "Fix WebKit blur": "Apply hardware-accelerated will-change: transform to glass blur",
};

export function CommandBar() {
  const [command, setCommand] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO(PR 5): send as a typed terminal.input message to the target agent's PTY.
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low shadow-lg">
      <div className="flex items-center justify-between text-outline font-label-sm text-label-sm px-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-primary">terminal</span>
          <span>{"Human Command & Steering Intervention"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Target: <strong className="text-primary font-medium">Nova (Frontend)</strong>
          </span>
          <span className="text-outline-variant">|</span>
          <kbd className="px-1.5 py-0.2 rounded bg-surface-container text-outline">
            ESC to abort
          </kbd>
        </div>
      </div>
      <form className="flex items-center gap-2" id="terminal-command-form" onSubmit={onSubmit}>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="font-code-sm text-code-sm text-primary font-semibold select-none">
            nova-agent:~$
          </span>
          <input
            className="w-full bg-transparent font-code-sm text-code-sm text-on-surface placeholder:text-outline focus:outline-none"
            id="terminal-input"
            placeholder="Type prompt, bash command, or ⌘K to pause and guide Nova..."
            type="text"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          />
        </div>
        <button
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
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
            type="button"
            onClick={() => setCommand(QUICK_PROMPTS["Revert last AST"] ?? "")}
          >
            {" "}
            Revert last AST{" "}
          </button>
          <button
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
            type="button"
            onClick={() => setCommand(QUICK_PROMPTS["Analyze chunks"] ?? "")}
          >
            {" "}
            Analyze chunks{" "}
          </button>
          <button
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
            type="button"
            onClick={() => setCommand(QUICK_PROMPTS["Fix WebKit blur"] ?? "")}
          >
            {" "}
            Fix WebKit blur{" "}
          </button>
        </div>
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
          <span>Autonomous Mode: Enabled</span>
        </div>
      </div>
    </div>
  );
}
