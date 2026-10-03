import type { ReactNode } from "react";

// Mock activity events reproducing the approved Stitch home screen.
// TODO(PR 15): replaced by the append-only event log streamed from the server.

export type ActivityKind = "assignment" | "commit" | "alert" | "update";

export interface ActivityEventMock {
  id: string;
  kind: ActivityKind;
  icon: string;
  title: string;
  /** Relative time label as shown in the design. */
  at: string;
  /** Detail line; may contain inline code formatting. */
  detail: ReactNode;
  tone: { iconBox: string; title: string; detail: string };
}

export const TEAM_ACTIVITY: readonly ActivityEventMock[] = [
  {
    id: "evt-assign-1",
    kind: "assignment",
    tone: {
      detail: "",
      iconBox: "bg-primary/20 border-primary/40 text-primary",
      title: "text-on-surface",
    },
    icon: "call_split",
    title: "Michael assigned task to Nova",
    at: "2m ago",
    detail: '"Build biometric passkey prompt with WebAuthn browser detection"',
  },
  {
    id: "evt-verify-1",
    kind: "update",
    tone: {
      detail: "",
      iconBox: "bg-secondary/20 border-secondary/40 text-secondary",
      title: "text-on-surface",
    },
    icon: "check_circle",
    title: "Atlas verified API endpoint",
    at: "8m ago",
    detail: (
      <>
        Successfully compiled{" "}
        <code className="text-secondary font-mono px-1 py-0.5 rounded bg-surface-container-high">
          /api/v2/auth/verify
        </code>{" "}
        with RS256 validation
      </>
    ),
  },
  {
    id: "evt-regression-1",
    kind: "alert",
    tone: {
      detail: "",
      iconBox: "bg-error/20 border-error/40 text-error",
      title: "text-error",
    },
    icon: "bug_report",
    title: "Scout captured regression",
    at: "14m ago",
    detail: "Found 2 test assertions failing under Safari WebKit runner (biometric prompt timeout)",
  },
  {
    id: "evt-tokens-1",
    kind: "commit",
    tone: {
      detail: "",
      iconBox: "bg-surface-container-high border-outline-variant/40 text-tertiary",
      title: "text-on-surface",
    },
    icon: "style",
    title: "Pixel updated dashboard tokens",
    at: "19m ago",
    detail: "Adjusted obsidian panel contrast ratios and synchronized spacing tokens across layout",
  },
  {
    id: "evt-pr-418",
    kind: "commit",
    tone: {
      detail: "font-mono",
      iconBox: "bg-primary-container/20 border-primary-container/40 text-primary-container",
      title: "text-on-surface",
    },
    icon: "commit",
    title: "Nova published Pull Request #418",
    at: "27m ago",
    detail: "feat(auth): initial passkey modal with biometric hardware attestation",
  },
];
