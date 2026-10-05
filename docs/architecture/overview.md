# Architecture overview

```
Browser (apps/web)
  │
  ├── REST (CORS: WEB_ORIGIN) ──▶ Fastify APIs        GET /api/health
  │                                   │
  │                                   └── Agent routes   /api/agents  (ADR 0006)
  │                                          ↓
  │                                      AgentRegistry   validation, lifecycle, events
  │                                          ↓
  │                                      DATA_DIR/agents.json   atomic JSON writes
  │
  └── WebSocket /ws/terminal (Origin: WEB_ORIGIN)
          ↓
      Terminal Gateway      validation, ownership, framing      (ADR 0005)
          ↓
       PtyManager           sessions, I/O, process-tree cleanup (ADR 0004)
          ↓
        node-pty
          ↓
       Local shell          allowlisted, cwd inside server-configured roots

packages/shared  ◀── Zod schemas + types used by both sides (API, terminal protocol, ...)
```

The browser never touches the filesystem or processes. All privileged work goes
through the server, which resolves allowlisted shells, fake agents and installed AI CLIs
through the server-owned ProviderRegistry. Browser payloads cannot configure executable paths or arguments.

API responses follow the contracts in `packages/shared/src/api.ts`; errors always use
`{ "error": { "code", "message" } }` (ADR 0003).

`createApp()` owns the registry, workspace manager, mailbox manager, message router, agent runtime manager, provider registry, task registry and one
`PtyManager` (`app.pty`). On startup it ensures existing agents' workspaces without
starting them. Fastify readiness starts the router before listening. On shutdown it
stops/drains routing, then agent runtimes and all remaining PTY sessions.

```text
Agent routes → AgentRuntimeManager.create → AgentRegistry → DATA_DIR/agents.json
                         │
                         └── AgentWorkspaceManager → DATA_DIR/hive/agents/<id>

AgentRuntimeManager.start/restart
  ├── AgentWorkspaceManager → validated workspace cwd
  └── ProviderRegistry → ProviderCommandResolver (filtered env, fixed argv)
                              ↓
               PtyManager.createSession({ cwd, command }) → node-pty → provider CLI

Scratch terminal gateway → PtyManager → default WORKSPACE_ROOT cwd
```

Workspace initialization is idempotent; metadata deletion preserves filesystem data
and recreation reuses it. See [ADR 0008](../adr/0008-agent-workspaces.md) for ownership,
path validation, rollback and isolation limits.

Milestone status is tracked in the README.

```text
AgentRegistry ──────────────────────┐
                                    ↓
AgentWorkspaceManager ──────────▶ MailboxManager (app.mailbox)
                                    ├── inbox/  validated reads + explicit acknowledgement
                                    └── outbox/ atomic writes + validated reads
```

The internal mailbox depends only on registry lookup and workspace paths. It requires
no running agent, exposes no browser endpoints, and never routes messages. See
[ADR 0009](../adr/0009-mailbox-layer.md) for the V1 message contract and filesystem limits.

```text
Agent A (or internal server code)
  ↓
MailboxManager.writeOutboxMessage
  ↓
Agent A/outbox ── chokidar + startup scan ──▶ MessageRouter
                                                ↓
                                MailboxManager.deliverInboxMessage
                                                ↓
                                        Agent B/inbox
                                                ↓
                                  explicit source acknowledgement

MessageRouter → MailboxManager + AgentWorkspaceManager + AgentRegistry
MessageRouter has no AgentRuntimeManager/PtyManager dependency.
```

Delivery preserves the envelope, recovers matching existing destinations, quarantines
permanent failures and bounds transient retries. A stopped agent can receive messages.
See [ADR 0010](../adr/0010-message-router.md) for lifecycle, recovery and limits.

```text
Browser Terminal
  ↓ WebSocket input/attachment
AgentRuntimeManager → server-owned runtime command resolver
  ↓
PtyManager → real node-pty process → Fake Agent CLI
                                    ↓ MailboxManager
                                 own outbox
                                    ↓
                               MessageRouter
                                    ↓
                                 other inbox
                                    ↓ MailboxManager
                              Fake Agent CLI
                                    ↓ result in own outbox
                               MessageRouter
                                    ↓
                              original inbox → CHECK_INBOX
```

Fake agents opt in with `providerId: "fake"`, only in development/test. Their workspace
and identity come from server configuration. The CLI reuses mailbox validation and
atomic publication, acknowledges incoming requests after response publication, and
never responds to results. AUTO_RESPOND scans immediately and then every 500 ms;
stopped-agent backlog survives until startup. Runtime/PTY lifecycle owns shutdown.
No real AI, task execution, provider registry or messaging UI is introduced. See
[ADR 0011](../adr/0011-fake-agent.md) for command semantics, retry memory and limits.

```text
User / future Orchestrator
  ↓ explicit actions via REST or internal methods
TaskRegistry (app.tasks)
  ├── DATA_DIR/tasks.json (atomic snapshots)
  ├── internal task events → Activity Publisher
  └── task state → validated web client → Mission Control

AgentRuntimeManager.delete → TaskRegistry.deleteAgent → active tasks return to Inbox
                                                      → AgentRegistry.delete
```

Tasks do not start agents and mailbox/fake-agent results do not change task state.
Runtime, mailboxes and tasks remain independent. A stopped agent can own a task.
The task queue coordinates assignment, transitions and agent deletion; terminal
tasks retain historical assignee IDs. See [ADR 0012](../adr/0012-task-system.md) for
transitions, startup repair, two-file crash limits and the deferred execution bridge.

## Persistent activity (PR 13)

```text
AgentRegistry committed identity/status + Runtime restart
TaskRegistry committed transitions
MessageRouter validated outbox/delivery/lifecycle facts
  ↓ safe allowlisted domain adapters (nonblocking)
Activity Publisher (server identity/time, serialized, persisted-before-notify)
  ↓
ActivityStore → DATA_DIR/events.jsonl
  ├── GET /api/activity (newest-first cursor pages + diagnostics)
  ├── GET /api/activity/summary (supported domain/history counts)
  └── /ws/activity (read-only, origin-checked, bounded backpressure)
        ↓ validated client, REST resnapshot on reconnect
      Activity page / Dashboard feed (100-event browser bound)
```

Activity observes committed facts; it never controls tasks, agents or message delivery.
Log failures allow domain operations to succeed and surface structured diagnostics and
live degraded status. See [ADR 0013](../adr/0013-activity-events.md) for ownership,
privacy, disk/history limits, corruption recovery and crash semantics.

## AI provider admission (PR 14)

`GET /api/providers` lazily discovers known CLI definitions with bounded version/help/auth
probes. Sixty-second caching and a three-provider concurrency limit isolate broken tools
from normal server operation. Null agent providers retain the local shell; fake uses the
same registry in development/test only. Installed Ollama remains unconfigured until model
selection exists. Browser requests cannot choose executable paths, argv, cwd or environment.
Agent provider environments replace, rather than merge, the parent server environment.
See [ADR 0014](../adr/0014-ai-provider-layer.md) for IDs, authentication and isolation limits.

## Explicit AI task execution (PR 15)

Task assignment remains separate from `POST /api/tasks/:id/execute`. The execution
coordinator dispatches a structured control task through the existing mailbox/router,
consumes the assigned inbox request and invokes a server-owned one-shot adapter in the
managed workspace. Results pass through agent outbox → router → system inbox before
correlation and server-controlled Review. Interactive PTYs remain independent.

Atomic `executions.json` records support status/result APIs, timeout/cancellation and
restart recovery. A fixed IPC watchdog cleans up provider trees on normal exit and hard
server death on macOS/Linux. Only verified Codex and development fake adapters advertise
automation. See [ADR 0015](../adr/0015-real-ai-execution.md) for contracts, lifecycle and
provider-native isolation limitations. AI success moves a task to Review; manual execution requires human completion.
Approved goal plans authorize the bounded orchestration review policy below.

## Goal orchestration (PR 16)

```text
User → Create draft → Generate Plan → validate → explicit Run Plan
                               ↓                     ↓
OrchestrationService → ordinary decision tasks + worker tasks → TaskRegistry
                               ↓                     ↓
                     AgentExecutionService → MailboxManager / MessageRouter
                               ↓
                     existing provider adapter / process lifecycle
                               ↓
                     validated result → Review → approve or bounded rework
                               ↓
                     all workers Completed → validated goal summary
```

`app.orchestration` persists separate atomic `orchestrations.json` snapshots and
observes committed task, execution and agent events. Worker IDs are reserved before
materialization; explicit Resume repairs a partial materialization with the same IDs.
Dependencies stay local to the plan; a service-wide cap and the existing one-execution
per-agent rule bound scheduling. Decision tasks use the orchestrator’s own workspace,
normal admission and result correlation. No generic provider actions are interpreted.
Shutdown pauses goals before execution cleanup; startup recovers executions first and
requires explicit Resume for unfinished goals. See [ADR 0016](../adr/0016-orchestrator.md)
for limits, retry policy, ownership protection and isolated-workspace limitations.
