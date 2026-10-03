import { useState } from "react";

interface DeleteAgentButtonProps {
  agentName: string;
  /** Performs the deletion; a rejection is shown inline and the button can be retried. */
  onDelete: () => Promise<void>;
}

const BUTTON =
  "flex items-center gap-1.5 px-3 py-2 rounded-lg font-body-sm text-body-sm transition-colors disabled:opacity-60";

/**
 * Two-step delete: the first click asks for confirmation in place (no modal), the second
 * deletes. Styled with the design's secondary buttons and error tokens.
 */
export function DeleteAgentButton({ agentName, onDelete }: DeleteAgentButtonProps) {
  const [phase, setPhase] = useState<"idle" | "confirming" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setPhase("deleting");
    setError(null);
    try {
      await onDelete();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete agent");
      setPhase("confirming");
    }
  };

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => setPhase("confirming")}
        className={`${BUTTON} bg-surface-container-high text-error hover:bg-error-container/30`}
      >
        <span className="material-symbols-outlined text-[16px]">delete</span>
        <span>Delete agent</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label={`Confirm deleting ${agentName}`}
      >
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Delete {agentName}?
        </span>
        <button
          type="button"
          onClick={() => setPhase("idle")}
          disabled={phase === "deleting"}
          className={`${BUTTON} bg-surface-container-high text-on-surface hover:bg-surface-container-highest`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={phase === "deleting"}
          className={`${BUTTON} bg-error-container text-on-error-container hover:brightness-110`}
        >
          <span className="material-symbols-outlined text-[16px]">delete_forever</span>
          <span>{phase === "deleting" ? "Deleting…" : "Delete"}</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="font-code-sm text-code-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
