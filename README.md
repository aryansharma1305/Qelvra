# Qelvra

A local, desktop-first multi-agent AI workspace: create agents, run each one in a
terminal, let them message each other through a filesystem mailbox, and track
their work as tasks.

## Requirements

- Node.js 22+ (see `.nvmrc`)

## Getting started

```sh
npm install
npm run dev        # server on http://127.0.0.1:3001 + web UI on http://127.0.0.1:5173
```

Configuration: copy `apps/server/.env.example` to `apps/server/.env` and
`apps/web/.env.example` to `apps/web/.env.local` to override the defaults.

Manual PTY check (developer-only, no API): `npm run pty:smoke -w @qelvra/server`.

First-time e2e setup: `npx playwright install chromium`. The app needs no network access;
fonts and images are bundled.

## Scripts

| Command                | What it does                                       |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start the API server and web app together          |
| `npm run dev:server`   | Start only the API server (watch mode)             |
| `npm run dev:web`      | Start only the web app                             |
| `npm run build`        | Typecheck and build every workspace                |
| `npm run start:server` | Run the built server (`apps/server/dist/index.js`) |
| `npm run typecheck`    | Typecheck every workspace and the tests            |
| `npm test`             | Unit and integration tests (Vitest)                |
| `npm run test:e2e`     | End-to-end tests; starts server and web            |
| `npm run test:design`  | Pixel parity vs the Stitch design (needs network)  |
| `npm run lint`         | ESLint                                             |
| `npm run format`       | Prettier (write)                                   |

## Layout

```
apps/web          React + Vite + Tailwind UI (ported from design/stitch)
design/stitch     Approved Stitch export: source of truth for visuals
apps/server       Fastify API server (127.0.0.1:3001)
packages/shared   Zod schemas and types shared by web and server
tests/            unit / integration / e2e / fixtures
docs/             architecture notes and ADRs
```

Agent shells start in `DATA_DIR/hive/agents/<id>/workspace`. Each agent also has
`inbox/`, `outbox/`, `agent.md` and `memory.md`. Deleting an agent preserves these
files; recreating its ID reuses them. The developer shell retains `WORKSPACE_ROOT`.
See [ADR 0008](docs/adr/0008-agent-workspaces.md) for initialization and safety limits.

The internal mailbox writes validated messages atomically into the sender's outbox;
no delivery occurs yet. Run the disposable check with
`npm run mailbox:smoke -w @qelvra/server`. See [ADR 0009](docs/adr/0009-mailbox-layer.md).

## Milestones

- [x] PR 1: Project bootstrap
- [x] PR 2: UI integration and routing
- [x] PR 3: Backend and health API
- [x] PR 4: PTY manager
- [x] PR 5: xterm + WebSocket terminal
- [x] PR 6: Agent registry
- [x] PR 7: Multiple agent terminals
- [x] PR 8: Agent workspace manager
- [x] PR 9: Mailbox
- [ ] PR 10: Router
- [ ] PR 11: Fake agent
- [ ] PR 12: Task system
- [ ] PR 13: Real AI CLI provider
- [ ] PR 14: Orchestrator
- [ ] PR 15: Activity dashboard
