# Beta architecture

```text
Web (React/Vite)
    ↓ HTTP + WebSocket
Fastify
    ├ Agents / filesystem registry
    ├ Tasks / filesystem registry
    ├ Orchestration / Goal scheduling and bounded review
    ├ Activity / retained JSONL events and read-only stream
    ├ Provider Registry / local detection and fixed commands
    ├ Runtime / interactive agent PTYs
    ├ Execution / watchdog-owned provider processes and results
    ├ Files / workspace-only browser and UTF-8 editor (v0.2 development)
    ├ Mailbox / validated filesystem messages
    └ Router / outbox → recipient inbox, at-least-once delivery
```

Shared Zod contracts validate inputs, outputs and snapshots. No database, accounts or cloud service are required. Commands, identities and workspace/mailbox paths are server-owned. Goals are plans requiring explicit approval, not automatic dispatch of arbitrary browser commands.

## Storage

Server defaults resolve from `apps/server`, including `.qelvra/`. Each agent uses `hive/agents/<id>/workspace/`, with sibling `inbox/`, `outbox/`, `agent.md` and `memory.md`. Deleting an agent preserves these files. `hive/system/` is the server control mailbox, not an agent. `hive/quarantine/<agent-id>/<generated-id>/` retains rejected message evidence and bounded reason metadata.

Authoritative snapshots: `agents.json`, `tasks.json`, `executions.json`, `orchestrations.json`. Observational history: `events.jsonl`. Snapshot formats retain their existing `version: 1`; there is no bulk rewrite or new migration framework. Backup the entire stopped-server DATA_DIR. Formats may change before stable release; unsupported/corrupt state is rejected rather than silently reset. Future format changes require an explicit migration or documented export/restore path.

Activity retains the newest 10,000 events in memory and caps its disk log at 32 MiB. At the disk cap, Activity reports degraded/capped and stops appending; primary task/agent work still proceeds. Corrupt lines are skipped with integrity warnings and preserved on disk. Stop Qelvra, archive the log securely, and remove the archived source from DATA_DIR before restarting to begin a new log; this is a deliberate history reset, not an automatic cleanup.

Snapshot startup loading is capped at 32 MiB per file. Keep authoritative history within that bound; beta has no pruning UI. Quarantine metadata is capped at 1,000 entries per agent. Exhaustion leaves the original outbox entry intact and blocks that entry with a controlled routing failure. Stop Qelvra and archive quarantine evidence before clearing its entries; startup/rescan can retry intact outbox messages. Agent workspace/mailbox payload content is user/provider responsibility. Provider scratch result directories are bounded and removed after execution; stdout is limited to 1 MiB. No persistent transcript/debug log is created automatically.

## Configuration

`.env.example` lists supported server settings. `HOST=127.0.0.1`, `PORT=3001`, `WEB_ORIGIN=http://127.0.0.1:5173`, `LOG_LEVEL=info`, `NODE_ENV=development`. `DATA_DIR=.qelvra` and `WORKSPACE_ROOT=.` resolve from the server cwd. The workspace root is for developer scratch terminals; agent terminals use their own managed workspace. Both must be usable writable real directories.

Execution timeout defaults to 20 minutes. Orchestration defaults: 20 tasks, 3 attempts, 3 concurrent workers, 1-hour timeout. Config permits up to 5 concurrent workers and controlled timeout ranges; invalid values fail startup. Use existing `EXECUTION_TIMEOUT_MS` and `ORCHESTRATION_*` variables rather than custom browser execution fields. Frontend `VITE_API_URL` is a build/dev setting in the web workspace, defaulting to API port 3001.

Shutdown drains/stops orchestration, executions, router/watchers, runtimes/PTYs and Activity subscriptions/persistence. Execution children have parent-death watchdogs. Startup never auto-starts PTYs or retry uncertain work: running runtimes become stopped, interrupted executions return to explicit retry, active goals pause for resume. Published messages may be recovered from destination/source state; this is at-least-once delivery, not an exactly-once distributed transaction.

## Files (v0.2 development)

`/files` selects registered agents and browses only their isolated workspace. Text
editing is limited to 1 MiB of valid UTF-8; symlinks/hard links and binary files are
not editable. Saves use atomic publication and revision conflicts. Folder deletion
is explicitly confirmed and bounded. See [ADR 0018](adr/0018-agent-files.md).

## Agent Memory (v0.2 development)

`/memory` reads and edits each registered agent’s fixed `memory.md`. Valid UTF-8 is
bounded to 256 KiB, atomic saves require a revision, and Activity stores metadata
only. Memory is not added to AI prompts. See [ADR 0019](adr/0019-agent-memory.md).
