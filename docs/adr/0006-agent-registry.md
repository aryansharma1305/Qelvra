# ADR 0006: Agent registry

- Status: accepted
- Date: 2026-10-03

## Context

The Agents pages showed design mock data. Later milestones (per-agent terminals, workspaces,
mailbox, providers) all need a durable answer to "which agents exist?". This milestone adds
that record and the management API, and nothing that runs an agent.

## Decision

- **Shape** (`packages/shared/src/agent.ts`): `{ id, name, role, status, providerId,
createdAt, updatedAt }`. The same Zod schemas validate API bodies on the server and API
  responses in the browser.
- **Ids**: `AgentIdSchema` (lowercase slug, at most 64 characters, no leading or trailing
  `-`), so an id is safe to use later in paths and process names. When the request leaves it
  out, the id is derived from the name (`"Frontend Nova"` → `frontend-nova`); a name that
  yields no valid id is rejected. A taken id is a 409 `AGENT_ALREADY_EXISTS`. Ids are never
  renumbered or reused silently.
- **Text limits**: name ≤ 80 and role ≤ 120 characters after trimming. Control, format and
  `<`/`>` characters are rejected (`AGENT_INVALID_NAME` / `AGENT_INVALID_ROLE`). React
  escapes output anyway; rejecting markup keeps the stored data clean for any future
  consumer (logs, prompts, other UIs).
- **The server owns status.** `POST /api/agents` accepts only `name`, `role` and an
  optional `id`. Anything else (`status`, `command`, `cwd`, `env`, `providerId`, ...) is
  ignored, never stored. New agents are `stopped`. The lifecycle (`created`, `starting`,
  `running`, `idle`, `working`, `stopping`, `stopped`, `error`) and its allowed transitions
  are enforced by `AgentRegistry.transition()`, which only server code can call. No
  route exposes it yet.
- **Persistence**: one JSON file, `DATA_DIR/agents.json` (default `.qelvra/` under the
  server's working directory, git-ignored), versioned (`{ "version": 1, "agents": [...] }`).
  Writes are atomic: temp file (mode 0600) → fsync → rename, serialized through a queue.
  If a write fails, the in-memory change is rolled back and the request fails, so memory
  and disk agree. A corrupt or invalid file stops the server with a clear message instead
  of being overwritten. On load, runtime states (`running`, `working`, ...) reset to
  `stopped`, because no process survives a server restart. No database: a few hundred
  small records do not need one; the store sits behind `AgentRegistry`, so it can be
  replaced without touching routes.
- **API**: `GET /api/agents` (oldest first), `GET /api/agents/:id`, `POST /api/agents`
  (201 `{ agent }`), `DELETE /api/agents/:id` (204). Unsafe ids in the path are rejected
  with 400 `AGENT_INVALID_ID` before any lookup; unknown ids are 404 `AGENT_NOT_FOUND`.
  Errors use the standard envelope (ADR 0003).
- **Layering**: `agents/agent-registry.ts` has no Fastify import; `routes/agents.ts` maps
  its typed errors to HTTP. The registry emits `agent.created/updated/deleted` to in-process
  subscribers. Nothing consumes them yet; PR 7 will use them for terminals.
- **Frontend**: a small store (`features/agents/agents-store.ts`, `useSyncExternalStore`)
  holds the list for the Agents page, sidebar badge and header pill; `useAgent` loads one
  agent for the profile. No data library was added. Fields that do not exist yet (provider,
  model, task, workspace, context window, telemetry) are shown as explicit placeholders
  ("No provider", "Not running", ...), never as mock values. Controls for features that do
  not exist yet (Message, Pause, Restart, Open Terminal, Import Manifest, Save Draft,
  capability filters) are disabled with a tooltip. Home, Swarm, Studio and Network remain
  design dashboards with mock data until runtime telemetry exists.
- **No demo seeding.** A fresh install shows an empty registry. Tests seed through the API.

## Consequences

- Deleting an agent removes only its record. Once agents own processes and workspaces
  (PR 7/8), delete must stop them first. The registry's transition table already has a
  `stopping` state for this.
- Single process only: the JSON store assumes one server per `DATA_DIR`.
- e2e and design suites run their own server (port 3101) and web app (5174) with a fresh
  `.qelvra-e2e/` data directory, so they never touch a developer's data or running server.
- Design parity for `/agents` and `/agents/:id` uses the six design agents registered
  through the API. Live text is masked after its position is checked, and the comparison
  stops where live content begins (the card grid or the profile card). That content's
  position is still checked.
