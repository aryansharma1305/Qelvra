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
through the server, which launches default allowlisted shells or a fixed server-owned
development/test fake CLI. Browser payloads cannot configure executable paths or arguments.

API responses follow the contracts in `packages/shared/src/api.ts`; errors always use
`{ "error": { "code", "message" } }` (ADR 0003).

`createApp()` owns the registry, workspace manager, mailbox manager, message router, agent runtime manager, task registry and one
`PtyManager` (`app.pty`). On startup it ensures existing agents' workspaces without
starting them. Fastify readiness starts the router before listening. On shutdown it
stops/drains routing, then agent runtimes and all remaining PTY sessions.

```text
Agent routes → AgentRuntimeManager.create → AgentRegistry → DATA_DIR/agents.json
                         │
                         └── AgentWorkspaceManager → DATA_DIR/hive/agents/<id>

AgentRuntimeManager.start/restart
  ├── AgentWorkspaceManager → validated workspace cwd
  └── PtyManager.createSession({ cwd }) → node-pty → local shell

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
  ├── internal task events → future Activity consumers
  └── task state → validated web client → Mission Control

AgentRuntimeManager.delete → TaskRegistry.deleteAgent → active tasks return to Inbox
                                                      → AgentRegistry.delete
```

Tasks do not start agents and mailbox/fake-agent results do not change task state.
Runtime, mailboxes and tasks remain independent. A stopped agent can own a task.
The task queue coordinates assignment, transitions and agent deletion; terminal
tasks retain historical assignee IDs. See [ADR 0012](../adr/0012-task-system.md) for
transitions, startup repair, two-file crash limits and the deferred execution bridge.
