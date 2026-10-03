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
through the server, which only launches commands from an allowlisted provider
registry.

API responses follow the contracts in `packages/shared/src/api.ts`; errors always use
`{ "error": { "code", "message" } }` (ADR 0003).

`createApp()` owns the registry, workspace manager, agent runtime manager and one
`PtyManager` (`app.pty`). On startup it ensures existing agents' workspaces without
starting them. On shutdown it stops agent runtimes, then all remaining PTY sessions.

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
