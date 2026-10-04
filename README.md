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
the router automatically delivers them to registered recipients, including stopped agents. Run the disposable check with
`npm run mailbox:smoke -w @qelvra/server` (mailbox alone) or
`npm run router:smoke -w @qelvra/server` (automatic routing and recovery).
See [ADR 0009](docs/adr/0009-mailbox-layer.md) and [ADR 0010](docs/adr/0010-message-router.md).

Development/test agents can opt into the fixed `providerId: "fake"` Node CLI. It supports
PING, ECHO, STATUS, SEND, SEND_TASK, CHECK_INBOX, RESPOND and AUTO_RESPOND ON/OFF.
Run `npm run fake:smoke -w @qelvra/server` for a disposable real PTY round-trip demo.
See [ADR 0011](docs/adr/0011-fake-agent.md) and the
[manual demo and verification](docs/verification/pr11-fake-agent.md).
Production mode disables fake agents; default agents retain local shells.

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
- [x] PR 10: Router
- [x] PR 11: Fake agent
- [x] PR 12: Task system
- [x] PR 13: Persistent activity events and live dashboard
- [x] PR 14: Safe AI CLI provider layer
- [ ] PR 15: Runtime telemetry

Activity is persisted in `DATA_DIR/events.jsonl` and available at `/api/activity` and
`/ws/activity`. `/activity` and Dashboard Team Activity use this live stream.
Run `npm run activity:smoke -w @qelvra/server` for a disposable fake-agent/task demo
with restart and privacy verification. See [ADR 0013](docs/adr/0013-activity-events.md).

Provider discovery is available at `GET /api/providers`. The Create Agent wizard uses
this API and submits a known provider ID; local shell remains the safe default.
Unavailable CLIs, missing authentication and Ollama model configuration are reported
honestly. No provider is installed or logged in automatically. See
[ADR 0014](docs/adr/0014-ai-provider-layer.md) and the
[provider verification report](docs/verification/pr14-ai-providers.md).
Run `npm run provider:smoke -w @qelvra/server -- codex` for a local-only disposable
interactive startup/cleanup check, without sending a model prompt.
