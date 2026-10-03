import type { KeyboardEvent } from "react";
import { ACCENT_CLASSES, type ToolDefinition } from "./agentDraft";

interface ToolChipProps {
  tool: ToolDefinition;
  enabled: boolean;
  onToggle: () => void;
}

// Enabled and disabled treatments are the two chip variants from the Stitch design.
export function ToolChip({ tool, enabled, onToggle }: ToolChipProps) {
  const accent = ACCENT_CLASSES[tool.accent];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={
        enabled
          ? "tool-chip cursor-pointer p-3.5 rounded-xl bg-surface-container flex items-center justify-between group transition-all"
          : "tool-chip cursor-pointer p-3.5 rounded-xl bg-surface-container-lowest flex items-center justify-between group transition-all hover:bg-surface-container"
      }
      role="checkbox"
      tabIndex={0}
      aria-checked={enabled}
      aria-label={tool.label}
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg ${enabled ? accent.iconBox : "bg-surface-container-high text-outline"} flex items-center justify-center`}
        >
          <span className="material-symbols-outlined text-[18px]">{tool.icon}</span>
        </div>
        <div>
          <div
            className={`font-headline-sm text-headline-sm ${enabled ? "text-on-surface" : "text-outline"}`}
          >
            {tool.label}
          </div>
          <div
            className={`font-code-sm text-code-sm ${enabled ? "text-on-surface-variant" : "text-outline"}`}
          >
            {tool.description}
          </div>
        </div>
      </div>
      <span
        className={`material-symbols-outlined ${enabled ? accent.check : "text-outline"} text-[20px] check-icon`}
      >
        {enabled ? "check_box" : "check_box_outline_blank"}
      </span>
    </div>
  );
}
