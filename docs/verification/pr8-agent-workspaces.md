# PR 8: Agent workspaces — completion report

## Files created

- `apps/server/src/workspaces/agent-workspace-manager.ts`
- `tests/unit/agent-workspace-manager.test.ts`
- `tests/integration/server/agent-workspaces.test.ts`
- `docs/adr/0008-agent-workspaces.md`
- `docs/verification/pr8-agent-workspaces.md`

## Files modified

- `apps/server/src/app.ts`: initialize/migrate workspaces and wire services.
- `apps/server/src/agents/agent-runtime-manager.ts`: queued creation/rollback and agent cwd.
- `apps/server/src/routes/agents.ts`: creation through the coordinator.
- `apps/server/src/pty/pty-manager.ts`: generic additional server-configured cwd roots.
- `apps/server/src/config/env.ts`, `apps/server/.env.example`: document DATA_DIR and scratch cwd.
- `apps/web/src/features/agents/presentation.ts`, `apps/web/src/pages/agents/AgentDrawer.tsx`:
  display real relative workspace paths in the existing card/drawer structure.
- `tests/unit/agent-runtime-manager.test.ts`: inject workspaces; fake PTY honors cwd.
- `tests/integration/websocket/agent-terminal.test.ts`: allow temporary agent cwd.
- `tests/integration/server/app.test.ts`, `tests/integration/websocket/terminal-gateway.test.ts`,
  `tests/fixtures/server-with-ptys.ts`: clean owned temporary data after processes stop.
- `tests/e2e/agent-terminal.spec.ts`: terminal-only workspace persistence/isolation/recreation.
- `playwright.design.config.ts`: use the verified three-worker rendering configuration.
- `docs/architecture/overview.md`, `README.md`: architecture, policies and milestone status.

## Workspace structure and manager API

```text
DATA_DIR/
  agents.json
  hive/agents/<id>/
    inbox/
    outbox/
    workspace/
    agent.md
    memory.md
```

The internal manager provides `open`, `ensureWorkspace({ id, name, role })`,
`getWorkspacePath(id)`, `exists(id)`, `relativePath(id)` and fixed-file `readMetadata`.
No general filesystem API or deletion endpoint exists.

## Security, transaction and lifecycle

Validated IDs and fixed server-owned segments determine paths. `lstat`, `realpath`
and containment checks refuse symlink escapes, aliases, wrong entry types and
metadata hard links. Initial files use exclusive/no-follow creation. New directories
use 0700 and files 0600 where supported. Existing data and permissions stay intact.

Creation persists registry metadata first, ensures the layout, and returns only after
success. Failure rolls back only newly created filesystem pieces, then registry
metadata. Starts/deletes/creates use the same per-agent lifecycle queue. Compensation
failures are surfaced explicitly rather than silently accepted.

Agent PTYs start in their own validated `workspace/` directory. Scratch terminals
retain WORKSPACE_ROOT. Startup initializes legacy workspaces, refuses unsafe/failed
migration, preserves metadata and never starts shells automatically. Deletion stops
the runtime and preserves filesystem data. Recreation reuses all files; custom
`agent.md` and `memory.md` are not overwritten.

## Test results

- Workspace unit tests: 25 passing cases, including concurrent ensure, content
  preservation, directory repair, permissions, traversal, symlinks, hard links and rollback.
- Workspace lifecycle integration tests: 9 passing cases, including creation,
  persistence failure, rollback, migration, delete/recreate and real-shell isolation.
- Critical workspace/runtime set: 76/76 in each of five consecutive runs.
- Full Vitest suite: 321/321 across 23 files.
- Focused agent-terminal browser suite: 9/9.
- Full browser suite: 62/62, one worker, no retries.
- Full design parity: 42/42 with three workers; original references, thresholds,
  compared regions and masks are unchanged. The plain `npm run test:design` command
  also passed 42/42 after the worker setting was recorded.
- Formatting, lint, type checking and production build: passed.

The first new browser check failed because a pwd path wrapped across narrow terminal
rows. Selecting the existing single-view control makes the complete pwd row visible;
production layout and assertions were not weakened. The initial five-worker design
run passed 40/42; two unchanged onboarding pages each differed by 530 text-edge pixels.
Inspection found text-edge differences; the unchanged comparisons passed 42/42 with
three workers. The configuration now uses that setting. No design baseline updates,
new masks or tolerance increases were introduced.

While adding cleanup to an existing shutdown fixture, an onClose hook was initially
registered after Fastify was listening. The corrected fixture removes its temporary
state on process exit, following graceful PTY shutdown. The final full unit/integration
run passed all signal-shutdown cases.

## Ad hoc verification and limitations

A separate real-PTY smoke exercise created Nova and Atlas in a fresh OS temporary
DATA_DIR and ran pwd in both. It created nova-file.txt in Nova, verified its absence
in Atlas, restarted Nova and verified persistence, deleted/recreated Nova metadata,
then verified file reuse and preserved agent.md. Cleanup reported zero PTY sessions
and removed the temporary DATA_DIR. Browser coverage independently exercises the same
policies, including persistent memory through recreation.

This is cwd isolation, not an OS sandbox. Shells run as the server OS user and can
intentionally access other permitted paths. A hostile same-user process can race
parent renames; descriptor-relative operations/OS isolation are deferred. Filesystem
and JSON persistence are not truly atomic; sustained rollback failure is logged and
surfaced, and interrupted initial files are preserved for owner inspection. Linux and
Windows were not separately exercised in this macOS run. See ADR 0008 for the policy.

Mailbox delivery, routing/watchers, AI providers, task assignment and orchestrator
behavior remain deferred. PR 9 has not started.

## Cleanup verification

Post-suite process inspection found no test servers, Playwright browsers, PTY shells
or foreground test sleep processes. The dedicated `.qelvra-e2e` DATA_DIR was removed
after both browser suites and server shutdown, including intentionally preserved
workspace data. Workspace unit/integration and smoke fixtures use owned OS temporary
directories and remove them on completion; existing shared/child-server fixtures now
also remove their own temporary DATA_DIR. All agent cwd paths observed by tests were
inside those configured disposable roots. No test starts the server against a real
user `.qelvra` directory or accepts a browser-selected filesystem path.

## Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build

# Run this identical critical set five times consecutively:
npm test -- tests/unit/agent-workspace-manager.test.ts tests/unit/agent-runtime-manager.test.ts tests/integration/server/agent-workspaces.test.ts tests/integration/websocket/agent-terminal.test.ts

CI=1 npm run test:e2e -- tests/e2e/agent-terminal.spec.ts --workers=1 --retries=0
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design -- --workers=3 --retries=0
npm run test:design
```

Suggested commit message: `feat(workspaces): add isolated agent workspaces`.
