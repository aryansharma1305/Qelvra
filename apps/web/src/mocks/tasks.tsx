import type { TaskStatus } from "@qelvra/shared";
import type { ReactNode } from "react";

// Mock tasks reproducing the approved Stitch Mission Control board.
// TODO(PR 12): replaced by the task API. The Working column keeps its three bespoke card
// designs in pages/tasks/KanbanBoard.tsx until real task data drives it.

interface TaskMockBase {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface InboxTaskMock extends TaskMockBase {
  status: "inbox";
  priority: string;
  description?: string;
  /** Footer row; each inbox card in the design shows different metadata. */
  footer: ReactNode;
  tone: { card: string; priority: string };
}

export interface AssignedTaskMock extends TaskMockBase {
  status: "assigned";
  priority: string;
  description: string;
  assignee: string;
  assigneeInitial: string;
  /** Agent-side state chip (e.g. "Spinning Env", "Queued"). */
  state: ReactNode;
  dependencies?: { label: string; steps: string };
  tone: { priority: string; assigneeAvatar: string };
}

export interface ReviewTaskMock extends TaskMockBase {
  status: "review";
  priority: string;
  description?: string;
  reviewer?: { initial: string; name: string; status: string };
  footerLabel: string;
  footerStatus: string;
  tone: { priority: string; footer: string; footerLabel: string | undefined; footerStatus: string };
}

export interface CompletedTaskMock extends TaskMockBase {
  status: "completed";
  meta: string;
  reference: string;
}

export const INBOX_TASKS: readonly InboxTaskMock[] = [
  {
    status: "inbox",
    tone: {
      card: "hover:shadow-lg",
      priority: "bg-surface-container-highest text-outline",
    },
    id: "#TSK-8931",
    priority: "Low",
    title: "Design deterministic token bucket for rate-limiting",
    footer: (
      <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-outline">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <span>Created 18m ago</span>
        </div>
        <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-mono">
          Unassigned
        </span>
      </div>
    ),
    description:
      "Queue backoff algorithm to throttle OpenAI tiered embeddings API calls during spike bursts.",
  },
  {
    status: "inbox",
    tone: {
      card: "",
      priority: "bg-secondary/10 text-secondary border border-secondary/20",
    },
    id: "#TSK-8932",
    priority: "Med",
    title: "Evaluate DeepSeek R1 reasoning tree benchmarks",
    footer: (
      <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
        <span className="font-code-sm text-code-sm text-outline flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-primary">device_hub</span>3
          subtasks
        </span>
        <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-mono">
          Triage
        </span>
      </div>
    ),
    description:
      "Compare inference speed vs Llama-3.3-70B on internal code synthesis test harness.",
  },
  {
    status: "inbox",
    tone: {
      card: "",
      priority: "bg-surface-container-highest text-outline",
    },
    id: "#TSK-8935",
    priority: "Low",
    title: "Telemetry aggregation pipeline memory leak check",
    footer: (
      <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-outline font-label-sm text-label-sm">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">alarm</span>
          45m ago
        </span>
        <span className="font-mono text-outline">vLLM Node 3</span>
      </div>
    ),
  },
];

export const ASSIGNED_TASKS: readonly AssignedTaskMock[] = [
  {
    status: "assigned",
    id: "#TSK-8928",
    tone: {
      priority: "bg-error-container/30 text-error border-error/30",
      assigneeAvatar: "bg-primary/20 text-primary",
    },
    priority: "High",
    title: "Postgres vector index partitioning (IVFFlat vs HNSW)",
    description:
      "Spawn pgvector container and benchmark recall performance across 2M 1536-dim embeddings.",
    assigneeInitial: "M",
    assignee: "Michael",
    state: (
      <span className="font-label-sm text-label-sm text-primary flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Spinning Env
      </span>
    ),
    dependencies: { label: "Deps: #TSK-8919", steps: "0 / 4 steps" },
  },
  {
    status: "assigned",
    id: "#TSK-8929",
    tone: {
      priority: "bg-secondary/10 text-secondary border-secondary/20",
      assigneeAvatar: "bg-secondary/20 text-secondary",
    },
    priority: "Med",
    title: "Generate OpenAPI 3.1 Swagger docs for Swarm RPC",
    description:
      "Parse TypeScript interfaces in `src/rpc` and auto-generate client SDK definitions.",
    assigneeInitial: "E",
    assignee: "Echo",
    state: <span className="font-label-sm text-label-sm text-on-surface-variant">Queued</span>,
  },
];

export const REVIEW_TASKS: readonly ReviewTaskMock[] = [
  {
    status: "review",
    id: "#TSK-8922",
    tone: {
      priority: "bg-error-container/30 text-error border-error/30",
      footer: "mt-2.5",
      footerLabel: "text-outline",
      footerStatus: "text-on-surface-variant font-mono",
    },
    priority: "High",
    title: "Multi-tenant isolated SQLite worker pool sync",
    footerLabel: 'Scout: "Found 2 fixtures in Safari WebKit"',
    footerStatus: "14m left",
    description:
      "Scout generated 18 integration tests. Awaiting human approval for cryptographic signature check.",
    reviewer: { initial: "S", name: "Scout (QA)", status: "PR #142 Ready" },
  },
  {
    status: "review",
    id: "#TSK-8920",
    tone: {
      priority: "bg-secondary/10 text-secondary border-secondary/20",
      footer: "mt-3 pt-2.5 border-t border-outline-variant/20",
      footerLabel: undefined,
      footerStatus: "text-amber-400 font-medium",
    },
    priority: "Med",
    title: "Audit Dockerfile multi-stage alpine base layers",
    footerLabel: "By Echo • 5 files changed",
    footerStatus: "Pending Lead Sign-off",
  },
];

export const COMPLETED_TASKS: readonly CompletedTaskMock[] = [
  {
    status: "completed",
    id: "#TSK-8918",
    title: "Set up Redis Cluster Sentinel failover topology",
    meta: "Atlas • 42m run",
    reference: "Commit #c89e21",
  },
  {
    status: "completed",
    id: "#TSK-8917",
    title: "Telemetry Prometheus exporter endpoint scrape hook",
    meta: "Michael • 22m",
    reference: "PR #138",
  },
  {
    status: "completed",
    id: "#TSK-8916",
    title: "Sync Figma design token CSS mapping variables",
    meta: "Pixel • 11m",
    reference: "PR #136",
  },
  {
    status: "completed",
    id: "#TSK-8915",
    title: "Auth0 schema migration & claim standardizer",
    meta: "Atlas • 55m",
    reference: "PR #135",
  },
];
