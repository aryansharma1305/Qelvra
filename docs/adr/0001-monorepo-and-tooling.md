# ADR 0001: Monorepo layout and tooling

- Status: accepted
- Date: 2026-10-02

## Context

Qelvra is a local multi-agent workspace: a React UI talking to a privileged Node
backend that spawns CLI processes through PTYs. Frontend and backend must share
validation schemas (agents, WebSocket messages, mailbox messages, tasks).

## Decision

- **npm workspaces** (`apps/*`, `packages/*`). npm ships with Node; pnpm/turbo add
  a tool for no current benefit.
- **`packages/shared`** holds Zod schemas and inferred types. It is consumed as
  TypeScript source (`exports` → `src/index.ts`) so no build step is needed for
  Vite or Vitest. The server (PR 3) will either run via `tsx` or bundle shared
  into its build output; that choice is made in PR 3.
- **Strict TypeScript** via `tsconfig.base.json` (`strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Tests live in top-level `tests/`** (unit / integration / e2e / fixtures), run
  by a single root Vitest config. Playwright is added with the first real UI flow.
- **Tailwind v4** via its Vite plugin (no PostCSS config).
- Dev servers bind to `127.0.0.1` only.

## Consequences

- Shared code must be platform-neutral (no `node:` or DOM imports) because it is
  compiled by both the browser and the server toolchains.
- Agent ids are restricted to `[a-z0-9-]` so they can be used directly as
  directory names without path traversal risk.
