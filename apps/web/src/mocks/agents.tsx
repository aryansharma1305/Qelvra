import type { AgentId } from "@qelvra/shared";
import type { ReactNode } from "react";

// Mock agent data for the Home and Swarm dashboards, reproducing the approved Stitch
// screens. Nothing here is real. The Agents pages use the agent registry (GET /api/agents);
// these dashboards switch to live data once runtime telemetry exists (PR 15).

/** Visual tokens for a home operative card. */
export interface HomeOperativeTone {
  iconBox: string;
  statusPill: string;
  statusDot: string;
  progressBlock: string;
  progressLabel: string;
  progressValue: string;
  progressBar: string;
}

export interface HomeOperativeMock {
  id: AgentId;
  icon: string;
  name: string;
  subtitle: string;
  statusLabel: string;
  task: string;
  /** Inline failure notice shown under the task (design: Scout). */
  alert?: string;
  progressLabel: string;
  progress: string;
  lastEvent: string;
  lastEventAt: string;
  tone: HomeOperativeTone;
}

/** Home (command center) worker cards; the orchestrator card is bespoke. */
export const HOME_OPERATIVES: readonly HomeOperativeMock[] = [
  {
    id: "nova",
    tone: {
      iconBox: "bg-secondary/15 text-secondary border-secondary/20",
      statusPill: "bg-secondary/10 text-secondary border-secondary/20",
      statusDot: "bg-secondary animate-pulse",
      progressBlock: "mt-4",
      progressLabel: "text-on-surface-variant",
      progressValue: "text-secondary",
      progressBar: "bg-secondary w-0",
    },
    icon: "web",
    name: "Nova",
    subtitle: "Frontend Architect • Claude 3.5 Sonnet",
    statusLabel: "Coming later",
    task: "Implement authentication flow & Passkey WebAuthn prompt components",
    progressLabel: "Component Suite",
    progress: "Not measured",
    lastEvent: "Sample event — no live work",
    lastEventAt: "Not measured",
  },
  {
    id: "atlas",
    tone: {
      iconBox: "bg-primary/15 text-primary border-primary/20",
      statusPill: "bg-secondary/10 text-secondary border-secondary/20",
      statusDot: "bg-secondary animate-pulse",
      progressBlock: "mt-4",
      progressLabel: "text-on-surface-variant",
      progressValue: "text-primary",
      progressBar: "bg-primary w-0",
    },
    icon: "dns",
    name: "Atlas",
    subtitle: "Systems & Backend • GPT-4o",
    statusLabel: "Coming later",
    task: "Draft Redis session store & asymmetric token rotation handlers",
    progressLabel: "Store Logic",
    progress: "Not measured",
    lastEvent: "Sample event — no live work",
    lastEventAt: "Not measured",
  },
  {
    id: "pixel",
    tone: {
      iconBox: "bg-surface-container-high text-on-surface-variant border-outline-variant/30",
      statusPill: "bg-tertiary/10 text-tertiary border-tertiary/20",
      statusDot: "bg-tertiary",
      progressBlock: "mt-4",
      progressLabel: "text-on-surface-variant",
      progressValue: "text-tertiary",
      progressBar: "bg-tertiary w-0",
    },
    icon: "palette",
    name: "Pixel",
    subtitle: "UI/UX Systems • Gemini 1.5 Pro",
    statusLabel: "Coming later",
    task: "Updated dashboard layout & mobile sheet responsive breakpoints",
    progressLabel: "Design Spec",
    progress: "Not measured",
    lastEvent: "Sample event — no live work",
    lastEventAt: "Not measured",
  },
  {
    id: "scout",
    alert: "Sample alert — coming later",
    tone: {
      iconBox: "bg-secondary/15 text-secondary border-secondary/20",
      statusPill: "bg-secondary/10 text-secondary border-secondary/20",
      statusDot: "bg-secondary animate-pulse",
      progressBlock: "mt-3",
      progressLabel: "text-on-surface-variant",
      progressValue: "text-secondary",
      progressBar: "bg-secondary w-0",
    },
    icon: "bug_report",
    name: "Scout",
    subtitle: "QA & Security • Claude 3.5 Sonnet",
    statusLabel: "Coming later",
    task: "E2E Playwright coverage for biometric fallback matrix",
    progressLabel: "Test Suite",
    progress: "Not measured",
    lastEvent: "Sample event — no live work",
    lastEventAt: "Not measured",
  },
  {
    id: "echo",
    tone: {
      iconBox: "bg-tertiary/15 text-tertiary border-tertiary/20",
      statusPill: "bg-surface-container-high text-on-surface-variant border-outline-variant/30",
      statusDot: "bg-tertiary",
      progressBlock: "mt-4",
      progressLabel: "text-tertiary",
      progressValue: "text-tertiary",
      progressBar: "bg-tertiary w-0",
    },
    icon: "manage_search",
    name: "Echo",
    subtitle: "Research & Docs • DeepSeek-R1",
    statusLabel: "Coming later",
    task: "Benchmarking WebAuthn specs across modern browser matrix",
    progressLabel: "Sample summary — coming later",
    progress: "Not measured",
    lastEvent: "Sample event — no live work",
    lastEventAt: "Not measured",
  },
];

/** Visual tokens for a swarm operative card. */
export interface SwarmOperativeTone {
  card: string;
  avatar: string;
  presenceDot: string;
  modelBadge: string;
  statusPill: string;
  statusDot: string;
  objectiveMeta: string;
  objective: string;
  contextIcon: string;
  /** Undefined renders the status without a colour class (design: Echo). */
  streamStatus: string | undefined;
}

export interface SwarmOperativeMock {
  id: AgentId;
  icon: string;
  name: string;
  model: string;
  role: string;
  statusLabel: string;
  objectiveMeta: string;
  objective: string;
  contextIcon: string;
  /** Rich one-line context under the objective. */
  context: ReactNode;
  streamLabel: string;
  streamStatus: string;
  /** Latest stdout line, with the design's log colouring. */
  streamLine: ReactNode;
  /** Omitted for idle agents, which show "Assign Objective" instead. */
  progress?: { label: string; detail: string; tone: { detail: string; bar: string } };
  tone: SwarmOperativeTone;
}

/** Swarm command center operative cards. */
export const SWARM_OPERATIVES: readonly SwarmOperativeMock[] = [
  {
    id: "nova",
    tone: {
      card: "relative border-primary/40 shadow-[0_0_24px_rgba(208,188,255,0.08)] hover:border-primary",
      avatar: "border-primary/40 text-primary",
      presenceDot: "bg-secondary",
      modelBadge: "bg-primary-container/30 text-primary-fixed border border-primary/30",
      statusPill: "bg-secondary-container/20 border-secondary/30 text-secondary",
      statusDot: "bg-secondary animate-ping",
      objectiveMeta: "text-on-surface-variant",
      objective: "text-on-surface",
      contextIcon: "text-primary",
      streamStatus: "text-tertiary",
    },
    icon: "brush",
    name: "Nova",
    model: "Claude 3.5",
    role: "Frontend Architect",
    statusLabel: "WORKING",
    objectiveMeta: "PR #412",
    objective:
      "Migrating telemetry widgets to responsive CSS grid and optimizing hardware composite transforms.",
    contextIcon: "hub",
    context: (
      <span>
        Paired with <strong className="text-on-surface">@Pixel</strong> for design tokens
      </span>
    ),
    streamLabel: "Not measured",
    streamStatus: "Not measured",
    streamLine: (
      <div className="text-on-surface-variant truncate">
        <span className="text-outline">Not measured</span> compiled{" "}
        <span className="text-secondary">AgentCard.tsx</span> Not measured{" "}
        <span className="text-tertiary">✓</span>
      </div>
    ),
    progress: {
      label: "Not measured",
      detail: "Not measured",
      tone: {
        detail: "text-on-surface",
        bar: "bg-gradient-to-r from-primary to-secondary w-0",
      },
    },
  },
  {
    id: "atlas",
    tone: {
      card: "border-outline-variant/30 hover:border-secondary/50",
      avatar: "border-secondary/40 text-secondary",
      presenceDot: "bg-secondary",
      modelBadge: "bg-surface-container-high text-on-surface-variant",
      statusPill: "bg-secondary-container/20 border-secondary/30 text-secondary",
      statusDot: "bg-secondary",
      objectiveMeta: "text-on-surface-variant",
      objective: "text-on-surface",
      contextIcon: "text-secondary",
      streamStatus: "text-secondary",
    },
    icon: "database",
    name: "Atlas",
    model: "GPT-4o",
    role: "Backend & Infra",
    statusLabel: "WORKING",
    objectiveMeta: "Not measured",
    objective: "Not measured",
    contextIcon: "dns",
    context: <span>Not available yet</span>,
    streamLabel: "Not measured",
    streamStatus: "active pipe",
    streamLine: (
      <div className="text-on-surface-variant truncate">
        <span className="text-outline">Not measured</span> redis cluster connected:{" "}
        <span className="text-secondary">10.42.0.1:6379</span>
      </div>
    ),
    progress: {
      label: "Not measured",
      detail: "Not measured",
      tone: { detail: "text-on-surface", bar: "bg-secondary w-0" },
    },
  },
  {
    id: "michael",
    tone: {
      card: "border-outline-variant/30 hover:border-primary/50",
      avatar: "border-primary-container text-primary-fixed",
      presenceDot: "bg-primary animate-pulse",
      modelBadge: "bg-primary/20 text-primary-fixed",
      statusPill: "bg-primary/20 border-primary/30 text-primary",
      statusDot: "bg-primary animate-ping",
      objectiveMeta: "text-primary",
      objective: "text-on-surface",
      contextIcon: "text-primary",
      streamStatus: "text-primary font-mono",
    },
    icon: "smart_toy",
    name: "Michael",
    model: "O3-Mini",
    role: "Swarm Orchestrator",
    statusLabel: "THINKING",
    objectiveMeta: "Step 2 of 4",
    objective:
      "Synthesizing test coverage reports and delegating regression fuzzing tasks to Scout.",
    contextIcon: "account_tree",
    context: <span>Not measured</span>,
    streamLabel: "reasoning_trace",
    streamStatus: "Not measured",
    streamLine: (
      <div className="text-on-surface-variant truncate">
        <span className="text-outline">Not measured</span> analyzing graph:{" "}
        <span className="text-primary-fixed">Not measured</span>
      </div>
    ),
    progress: {
      label: "Generating Plan",
      detail: "CoT Active",
      tone: { detail: "text-primary", bar: "bg-primary-container w-0 animate-pulse" },
    },
  },
  {
    id: "pixel",
    tone: {
      card: "border-outline-variant/30 hover:border-primary/50",
      avatar: "border-outline-variant/40 text-on-surface-variant",
      presenceDot: "bg-primary",
      modelBadge: "bg-surface-container-high text-on-surface-variant",
      statusPill: "bg-primary-container/20 border-primary-container/40 text-primary-fixed",
      statusDot: "bg-primary-container",
      objectiveMeta: "text-tertiary",
      objective: "text-on-surface",
      contextIcon: "text-tertiary",
      streamStatus: "text-outline",
    },
    icon: "palette",
    name: "Pixel",
    model: "Gemini Pro",
    role: "UI/UX Designer",
    statusLabel: "REVIEWING",
    objectiveMeta: "WCAG AAA",
    objective:
      "Evaluating contrast ratios and micro-interaction easing curves across dark surfaces.",
    contextIcon: "check_circle",
    context: <span>Not measured</span>,
    streamLabel: "Not measured",
    streamStatus: "idle",
    streamLine: (
      <div className="text-on-surface-variant truncate">
        <span className="text-outline">Not measured</span> sync:{" "}
        <span className="text-on-surface">design-system.json updated</span>
      </div>
    ),
    progress: {
      label: "Not measured",
      detail: "Pending Review",
      tone: { detail: "text-tertiary", bar: "bg-tertiary-container w-0" },
    },
  },
  {
    id: "scout",
    tone: {
      card: "border-outline-variant/30 hover:border-tertiary/50",
      avatar: "border-tertiary/40 text-tertiary",
      presenceDot: "bg-tertiary",
      modelBadge: "bg-surface-container-high text-on-surface-variant",
      statusPill: "bg-tertiary-container/20 border-tertiary/30 text-tertiary",
      statusDot: "bg-tertiary animate-pulse",
      objectiveMeta: "text-tertiary",
      objective: "text-on-surface",
      contextIcon: "text-tertiary",
      streamStatus: "text-tertiary",
    },
    icon: "security",
    name: "Scout",
    model: "Claude 3.5",
    role: "QA & Security",
    statusLabel: "WORKING",
    objectiveMeta: "Not measured",
    objective:
      "Running Playwright E2E browser tests and authentication fuzzing against canary node.",
    contextIcon: "verified_user",
    context: <span>Zero critical security leaks</span>,
    streamLabel: "Not measured",
    streamStatus: "pass",
    streamLine: (
      <div className="text-on-surface-variant truncate">
        <span className="text-outline">Not measured</span> spec:{" "}
        <span className="text-tertiary">e2e/auth-flow.spec.ts (1.1s)</span>
      </div>
    ),
    progress: {
      label: "Not measured",
      detail: "Not measured",
      tone: { detail: "text-on-surface", bar: "bg-tertiary w-0" },
    },
  },
  {
    id: "echo",
    tone: {
      card: "border-outline-variant/30 hover:border-outline opacity-85 hover:opacity-100",
      avatar: "border-outline-variant/30 text-outline",
      presenceDot: "bg-outline",
      modelBadge: "bg-surface-container-high text-on-surface-variant",
      statusPill: "bg-surface-container-high border-outline-variant/40 text-on-surface-variant",
      statusDot: "bg-outline",
      objectiveMeta: "text-outline",
      objective: "text-on-surface-variant",
      contextIcon: "",
      streamStatus: undefined,
    },
    icon: "psychology",
    name: "Echo",
    model: "DeepSeek-R1",
    role: "Deep Research & Docs",
    statusLabel: "IDLE",
    objectiveMeta: "WARMED",
    objective: "Awaiting next doc synthesis or deep architectural benchmark query from operator.",
    contextIcon: "cached",
    context: <span>Not measured</span>,
    streamLabel: "status_hook",
    streamStatus: "ready",
    streamLine: (
      <div className="text-outline truncate">
        <span className="text-outline">Not measured</span> Standing by for swarm instruction
      </div>
    ),
  },
];
