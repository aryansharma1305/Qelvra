import type { ProviderId } from "@qelvra/shared";
// Form state for the Create Agent wizard. Defaults reproduce the Stitch design's mock values.
// Name, role and a canonical provider ID are submitted. Other draft controls are design previews.

export const WIZARD_STEPS = [
  { title: "IDENTITY", subtitle: "Operative Alias & Role Profile" },
  { title: "INTELLIGENCE", subtitle: "Installed CLI & Availability" },
  { title: "CAPABILITIES", subtitle: "Synthesizing Operative Profile" },
  { title: "WORKSPACE", subtitle: "Filesystem Mounting & IPC Bus" },
  { title: "DIRECTIVE", subtitle: "System Prompt & Guidelines" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

export function clampStep(value: unknown): number {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= TOTAL_STEPS ? step : 1;
}

export type Accent = "primary" | "secondary" | "tertiary";

/** Literal class strings per accent so Tailwind can see them. */
export const ACCENT_CLASSES: Record<Accent, { iconBox: string; check: string; dot: string }> = {
  primary: { iconBox: "bg-primary/20 text-primary", check: "text-primary", dot: "bg-primary" },
  secondary: {
    iconBox: "bg-secondary/20 text-secondary",
    check: "text-secondary",
    dot: "bg-secondary",
  },
  tertiary: { iconBox: "bg-tertiary/20 text-tertiary", check: "text-tertiary", dot: "bg-tertiary" },
};

export interface ToolDefinition {
  id: string;
  label: string;
  /** Shorter label used in the live preview chips. */
  shortLabel: string;
  description: string;
  icon: string;
  accent: Accent;
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: "coding",
    label: "Coding",
    shortLabel: "Coding",
    description: "AST & Refactor",
    icon: "code",
    accent: "primary",
  },
  {
    id: "terminal",
    label: "Terminal",
    shortLabel: "Terminal",
    description: "PTY Bash Shell",
    icon: "terminal",
    accent: "secondary",
  },
  {
    id: "git",
    label: "Git Ops",
    shortLabel: "Git Ops",
    description: "Branch & Rebase",
    icon: "commit",
    accent: "tertiary",
  },
  {
    id: "files",
    label: "File Access",
    shortLabel: "File I/O",
    description: "Provider-owned I/O",
    icon: "folder_open",
    accent: "primary",
  },
  {
    id: "testing",
    label: "Testing",
    shortLabel: "Testing",
    description: "Pytest / Jest",
    icon: "bug_report",
    accent: "secondary",
  },
  {
    id: "browser",
    label: "Headless Web",
    shortLabel: "Headless",
    description: "Playwright DOM",
    icon: "globe",
    accent: "primary",
  },
  {
    id: "research",
    label: "Deep Research",
    shortLabel: "Research",
    description: "Arxiv & Docs",
    icon: "travel_explore",
    accent: "secondary",
  },
  {
    id: "design",
    label: "Design Tokens",
    shortLabel: "Design",
    description: "Tailwind & Figma",
    icon: "palette",
    accent: "primary",
  },
  {
    id: "egress",
    label: "External Egress",
    shortLabel: "Egress",
    description: "Unrestricted HTTP",
    icon: "wifi",
    accent: "tertiary",
  },
];

export const DIRECTIVE_PRESETS = {
  security: `<role>\nYou are Kite, an autonomous security auditor and hardening operative.\nStrict zero-trust verification applies to every execution step.\n</role>\n\n<operational_heuristics>\n- Disallow any unauthenticated network egress.\n- Sanitize all AST mutations against taint-analysis rules.\n</operational_heuristics>`,
  velocity: `<role>\nYou are Kite, a rapid prototyping and continuous build operative.\nPrioritize rapid test-driven iteration and micro-benchmarking.\n</role>\n\n<operational_heuristics>\n- Execute parallel pytest runners across 8 threads.\n- Push automatic ephemeral staging branches for each patch.\n</operational_heuristics>`,
  architect: `<role>\nYou are Kite, an autonomous distributed systems architect operating inside the Hyperion Mesh.\nYour mandate is zero-downtime micro-optimizations, kernel-level tracing, and multi-repo consistency.\n</role>\n\n<operational_heuristics>\n- Never output unchecked terminal commands.\n- Verify AST invariants before committing code refactors.\n- Coordinate with sibling worker nodes via IPC broadcast channel @kite.\n</operational_heuristics>`,
} as const;
export type DirectivePreset = keyof typeof DIRECTIVE_PRESETS;

export interface AgentDraft {
  name: string;
  role: string;
  avatar: number;
  provider: ProviderId;
  /** 0–100 slider value; the model temperature is value / 100. */
  temperature: number;
  tools: ReadonlySet<string>;
  preset: DirectivePreset | null;
  directive: string;
}

export const DEFAULT_AGENT_DRAFT: AgentDraft = {
  name: "Kite",
  role: "Staff Systems Architect & DevOps Lead",
  avatar: 0,
  provider: "shell",
  temperature: 25,
  tools: new Set(["coding", "terminal", "git", "files", "testing", "browser"]),
  preset: "architect",
  directive: DIRECTIVE_PRESETS.architect,
};

export function temperatureLabel(sliderValue: number): string {
  const value = sliderValue / 100;
  const description =
    value < 0.3
      ? "Deterministic Code Architecture"
      : value > 0.7
        ? "Creative Hypothesis Mode"
        : "Balanced Reasoning";
  return `${value.toFixed(2)} (${description})`;
}

export function providerLabel(id: ProviderId): string {
  return {
    shell: "Local shell",
    fake: "Fake agent (development)",
    ollama: "Ollama",
    codex: "Codex",
    gemini: "Gemini CLI",
    "claude-code": "Claude Code",
    opencode: "OpenCode",
  }[id];
}
