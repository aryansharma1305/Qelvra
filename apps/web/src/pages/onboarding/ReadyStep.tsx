// Ported from the Stitch export (agent_hive_onboarding_workspace_ready/code.html). Keep visually identical to the design.
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { LaunchedTeam } from "./LaunchedTeam";

export function ReadyStep() {
  const navigate = useNavigate();

  // "Press ⏎" in the design enters the workspace.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) navigate("/");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <main className="w-full pt-16 flex-1 flex flex-col justify-center relative">
      <div className="flex flex-col w-full">
        <div className="relative w-full overflow-hidden px-gutter md:px-margin-lg lg:px-margin-lg py-space-xl flex flex-col items-center">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-60">
            <div className="absolute w-[680px] h-[680px] rounded-full bg-primary/10 blur-[130px] animate-pulse" />
            <div className="absolute w-[440px] h-[440px] rounded-full bg-secondary/10 blur-[90px]" />
            <svg
              className="absolute w-[900px] h-[900px] text-primary/10 animate-[spin_120s_linear_infinite]"
              fill="none"
              viewBox="0 0 800 800"
            >
              {" "}
              <circle
                cx="400"
                cy="400"
                r="160"
                stroke="currentColor"
                strokeDasharray="4 8"
                strokeWidth="1"
              />{" "}
              <circle
                cx="400"
                cy="400"
                r="260"
                stroke="currentColor"
                strokeDasharray="1 12"
                strokeWidth="1"
              />{" "}
              <circle
                cx="400"
                cy="400"
                r="360"
                stroke="currentColor"
                strokeDasharray="2 16"
                strokeWidth="1"
              />{" "}
              <line
                stroke="currentColor"
                strokeDasharray="6 6"
                strokeWidth="0.5"
                x1="400"
                x2="400"
                y1="40"
                y2="760"
              />{" "}
              <line
                stroke="currentColor"
                strokeDasharray="6 6"
                strokeWidth="0.5"
                x1="40"
                x2="760"
                y1="400"
                y2="400"
              />{" "}
            </svg>
          </div>
          <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
            <div className="inline-flex items-center gap-space-sm px-space-md py-1 rounded-full bg-surface-container-high/70 backdrop-blur-md mb-space-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-ping" />
              <span className="font-label-md text-label-md uppercase tracking-widest text-primary">
                05 / 05 — Launchpad
              </span>
              <span className="text-outline-variant font-code-sm text-code-sm">•</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Not available yet
              </span>
            </div>
            <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
              <h1 className="font-display text-display tracking-tight text-on-surface mb-space-xs font-semibold">
                Your hive is online.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl text-center">
                The swarm has been initialized and synchronized. All four autonomous workers are
                standing by for deterministic orchestration.
              </p>
            </div>
            <div className="w-full flex items-center justify-center my-space-lg">
              <div className="relative flex items-center justify-center p-space-xs">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                <div className="relative w-28 h-28 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-2xl">
                  <svg
                    className="absolute inset-0 w-full h-full text-secondary animate-[spin_24s_linear_infinite]"
                    viewBox="0 0 100 100"
                  >
                    {" "}
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      opacity="0.7"
                      r="44"
                      stroke="currentColor"
                      strokeDasharray="8 14"
                      strokeWidth="1.5"
                    />{" "}
                  </svg>
                  <svg
                    className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] text-primary animate-[spin_16s_linear_infinite_reverse]"
                    viewBox="0 0 100 100"
                  >
                    {" "}
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      opacity="0.6"
                      r="42"
                      stroke="currentColor"
                      strokeDasharray="4 8"
                      strokeWidth="1"
                    />{" "}
                  </svg>
                  <div className="flex flex-col items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary text-[38px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      hub
                    </span>
                    <span className="font-code-sm text-code-sm text-tertiary font-medium tracking-tighter">
                      Coming later
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <LaunchedTeam />
            <div className="w-full bg-surface-container-low/90 backdrop-blur-md rounded-xl p-space-md mb-space-xl shadow-inner">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-space-md text-on-surface-variant font-code-md text-code-md">
                <div className="flex items-center gap-space-sm w-full lg:w-auto justify-start">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">
                    verified
                  </span>
                  <span className="text-on-surface">Enclave Security:</span>
                  <span className="text-tertiary font-medium">Workspace per agent</span>
                </div>
                <div className="hidden lg:block w-px h-4 bg-surface-variant" />
                <div className="flex items-center gap-space-sm w-full lg:w-auto justify-start">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    memory
                  </span>
                  <span className="text-on-surface">Runtime:</span>
                  <span className="text-on-surface-variant">
                    {"Ollama (qwen2.5-coder:32b & deepseek-r1)"}
                  </span>
                </div>
                <div className="hidden lg:block w-px h-4 bg-surface-variant" />
                <div className="flex items-center gap-space-sm w-full lg:w-auto justify-start">
                  <span className="material-symbols-outlined text-primary text-[18px]">speed</span>
                  <span className="text-on-surface">Telemetry:</span>
                  <span className="text-primary-fixed-dim">Not measured</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-space-md w-full max-w-lg mb-space-sm">
              <button
                className="w-full sm:w-auto flex-1 h-12 px-space-xl rounded-xl bg-primary-container text-on-primary-container font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-space-md shadow-[0_0_24px_rgba(160,120,255,0.45)] hover:shadow-[0_0_36px_rgba(160,120,255,0.65)] hover:bg-primary transition-all duration-200 group active:scale-[0.98]"
                id="launch-button"
                type="button"
                onClick={() => navigate("/")}
              >
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-45">
                  rocket_launch
                </span>
                <span>Enter Qelvra</span>
                <kbd className="hidden md:inline-flex items-center ml-space-xs px-2 py-0.5 rounded bg-on-primary-container/20 text-on-primary-container font-code-sm text-code-sm">
                  ⏎
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => navigate("/terminal")}
                className="w-full sm:w-auto px-space-lg h-12 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-body-md text-body-md font-medium transition-all duration-150 flex items-center justify-center gap-space-sm active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  terminal
                </span>
                <span>Open Swarm Terminal Directly</span>
              </button>
            </div>
            <p className="font-code-sm text-code-sm text-outline tracking-wide mt-space-sm flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Deterministic session token active • Press
              <kbd className="text-on-surface bg-surface-container px-1 py-0.5 rounded">⏎</kbd>
              to launch
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
