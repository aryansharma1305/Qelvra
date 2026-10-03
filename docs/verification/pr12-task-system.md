# PR 12: Task system verification and handoff

Verified on 2026-10-04. This milestone adds persistent tasks and connects Mission
Control to real data. [ADR 0012](../adr/0012-task-system.md) records the decisions.
PR 13, real AI providers, orchestration and execution are deferred.

## 1. Files created

- `apps/server/scripts/task-smoke.ts`
- `apps/server/src/tasks/index.ts`
- `apps/server/src/tasks/task-errors.ts`
- `apps/server/src/tasks/task-registry.ts`
- `apps/server/src/tasks/task-routes.ts`
- `apps/web/src/features/tasks/tasks-store.ts`
- `apps/web/src/pages/tasks/CreateTaskForm.tsx`
- `apps/web/src/pages/tasks/presentation.ts`
- `docs/adr/0012-task-system.md`
- `docs/verification/pr12-task-system.md`
- `tests/design/task-parity.ts`
- `tests/e2e/tasks.spec.ts`
- `tests/integration/server/tasks-api.test.ts`
- `tests/unit/task-registry.test.ts`
- `tests/unit/web-tasks-api.test.ts`
- `tests/unit/web-tasks-store.test.ts`

## 2. Files modified or removed

- `README.md`
- `apps/server/package.json`
- `apps/server/src/agents/agent-runtime-manager.ts`
- `apps/server/src/app.ts`
- `apps/server/src/routes/agents.ts`
- `apps/web/src/components/shell/AppSidebar.tsx`
- `apps/web/src/components/shell/navigation.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/mocks/tasks.tsx` (removed)
- `apps/web/src/pages/tasks/KanbanBoard.tsx`
- `apps/web/src/pages/tasks/MissionControlHeader.tsx`
- `apps/web/src/pages/tasks/TaskCards.tsx`
- `apps/web/src/pages/tasks/TaskInspector.tsx`
- `apps/web/src/pages/tasks/TasksPage.tsx`
- `docs/architecture/frontend.md`
- `docs/architecture/overview.md`
- `packages/shared/src/api.ts`
- `packages/shared/src/task.ts`
- `tests/design/parity.spec.ts`
- `tests/e2e/navigation.spec.ts`
- `tests/e2e/workspace.spec.ts`
- `tests/unit/mocks.test.ts`
- `tests/unit/task-schema.test.ts`

## 3. Task schema

Strict Task: server-generated UUID v4 ID; trimmed printable title 1–160 chars;
description 0–16 KiB UTF-8; six statuses; nullable AgentId assignee; controlled
createdBy=user; ISO UTC createdAt and updatedAt. Inbox requires null assignee; other
states require an ID. Creation strips caller IDs, status, author and timestamps.
No priority, result ID, scheduling, dependencies or subtask fields were added.

## 4. Registry API

open, create, get, require, list, assign, start, review, complete, fail, deleteAgent,
subscribe. All changes use one promise queue because they share one snapshot file.
Frozen snapshots and committed-only reads/events prevent dirty state exposure.

## 5. Transition rules

Inbox → Assigned → Working → Review → Completed. Review → Working is supported;
Assigned/Working/Review → Failed. Completed/Failed are terminal. Invalid transitions
return a controlled 409 and do not mutate timestamps. No generic status-write API.

## 6. Persistence

DATA_DIR/tasks.json, version 1; atomic sibling-temp/file fsync/rename/best-effort
directory fsync, matching AgentRegistry. Load validates full records and duplicate
IDs, refuses corrupt files, and never silently overwrites them. Missing file is an
empty registry. Stable createdAt/ID ordering survives reload. Failed saves preserve
the committed disk/memory state and emit no success events. updatedAt is monotonic.

## 7. Agent deletion

The composed runtime stops the agent, then the task queue persists active-owned tasks
as Inbox with null assignee before deleting agent metadata. Content and creation time
are preserved. Task-save failure refuses deletion; agent-save failure restores tasks.
Completed/Failed retain historical assignee IDs. Startup repairs active orphans.
Separate files have a documented crash window: Inbox tasks may remain alongside a
still-registered agent; this valid state is recoverable through reassignment.

## 8. REST endpoints

GET/POST /api/tasks; GET /api/tasks/:id; POST /api/tasks/:id/assign with agentId;
POST /api/tasks/:id/start, /review, /complete, /fail with no task fields. Creation
returns 201, lifecycle/get/list 200; invalid input 400, missing task 404, conflicts
409, persistence failure 500. Responses and errors use shared schemas/envelopes.

## 9. Frontend integration

Validated centralized API helpers; lightweight tasks-store; live Mission Control
header, five-column board (plus Failed when present), cards, selected-task inspector, Create Task form, optional
assignee and assignment pickers, lifecycle controls, status filters (including Failed),
real metrics and sidebar count. Mutation responses update local state, cancel stale
lists and refetch a conflicting task. Page entry/Refresh refetch tasks and agents.
Loading/error/retry/empty states, pending controls, keyboard open/close and focus
restoration are supported. Mobile panels fit the viewport; board remains scrollable.

## 10. Mock fields

Removed production task fixture module, mock IDs/assignees/metrics, priorities,
per-task progress, elapsed durations, dependencies, milestones, artifacts and task
telemetry/communications. Retained design chrome and actual completed/total bar.
Unsupported List/DAG views are disabled. Global shell hardware mocks and other
pages' mocks remain outside this milestone. No production demo tasks are seeded.

## 11. Unit tests

Schema bounds/control characters/UTF-8/invariants, server ownership, frozen snapshots,
full lifecycle/return/fail, events, monotonic/restart timestamps, stable/tied sorting,
corruption/duplicates, simultaneous assignment/start/create, committed-only visibility,
failed task persistence, deletion/rollback/recovery, deletion races, listener failures,
validated web API calls and request coordination. Focused suite: 45 tests in 5 files.

## 12. API integration tests

15 cases exercise all endpoints through Fastify injection, controlled/malformed input,
unknown tasks/agents, denied shortcuts/status fields, normal lifecycle, failure,
concurrent starts, runtime-independent assignment, deletion/restart, persistence error
redaction and startup corruption. No ordinary integration test needs a network port.
Task actions produce no mailbox data or PTY sessions.

## 13. Browser flows

Build login form: Inbox → Nova assignment → Assigned → Start → Working → Review →
Return to Working → Review → Complete; reload preserves Completed/read-only state.
Create API: assign Atlas, Start, delete Atlas through agent UI; task returns to Inbox,
retains its description and no longer offers Atlas. Separate cases cover Failed filter,
read-only details, selection/close/Escape/focus, keyboard creation, empty/list error and
retry, input validation, creation failure and recoverable form values. The navigation
badge assertion now uses an actual validated API snapshot instead of mock IDs/counts.

## 14. Repeated runs

45/45 in five consecutive final focused runs: 1.68, 1.68, 1.66, 1.93, 2.29 seconds;
225 successful executions. No retries or global timeout changes.

## 15. Design checks

42/42 in the final full run (3.1 minutes). Global pixel tolerance remains 300 mismatched pixels,
pixelmatch threshold 0.1. Original Stitch exports remain unchanged.

The three Mission Control cases now compare the original frame contract directly:
header/metric/board/column/card/inspector widths, horizontal positions, padding,
borders, radii, palette, card typography and vertical rhythm. Fourteen real API tasks
cover all five columns; actual titles, status mapping, counts and selected inspector
are asserted. The global header still receives its pixel comparison. The other 39
cases retain their existing pixel comparisons/masks. Task inner content heights and
header wrapping vary with real data and the removal of unsupported design claims;
this is not a claim of identical task-content pixels. No unsupported figures are
normalized into fake production values. Desktop/mobile were inspected in one batch;
the Impeccable detector returned no findings.

## 16. Full suite

- Format, lint and typecheck: passed.
- Unit/integration: 469/469 tests across 36 files.
- Build: passed for server/web/shared.
- Browser: 66/66 (1.5 minutes), one worker / zero retries.
- Design: 42/42, one worker; task frame/data checks and other screen pixel comparisons.
- Disposable smoke: passed.

## 17. Manual verification

`npm run task:smoke -w @qelvra/server` creates actual Nova/Atlas records and two tasks
through the real app/REST, exercises assignment/start/review/return/complete/fail,
closes and recreates the server twice, compares persisted records, deletes Atlas while
its task is in Review and checks preserved content/Inbox fallback. It asserts zero
PTYs and no temporary publications, then removes its owned temporary directory.

The browser lifecycle and deletion are also verified against the real isolated stack.
Localhost remains available at http://127.0.0.1:5173/tasks. Developer DATA_DIR has zero
tasks; the existing Kite agent/workspace is preserved. Tests use temporary directories
or the existing isolated .qelvra-e2e configuration (ports 3101/5174).

## 18. Known limitations

One writer per DATA_DIR; JSON snapshot cost grows with task volume. No database,
event log, task edits/deletion, retry/unassignment, realtime sync, advanced scheduling,
DAG or AI execution. Separate agent/task snapshots are coordinated rather than a
cross-file database transaction. Completed/Failed preserve an ID, not an immutable
copy of the deleted agent's name/role. Fake-agent result messages are not task-state
authority; optional mailbox execution/bridge is deliberately deferred.

## 19. Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run task:smoke -w @qelvra/server
```

Five consecutive runs:

```sh
for attempt in 1 2 3 4 5; do
  npx vitest run tests/unit/task-registry.test.ts tests/unit/task-schema.test.ts tests/unit/web-tasks-api.test.ts tests/unit/web-tasks-store.test.ts tests/integration/server/tasks-api.test.ts || exit 1
done
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
git diff --check
```

## 20. Commit SHA

The completion response supplies the final SHA after committing this report.

## 21. GitHub CI

The completion response links the CI run for that SHA and reports its final result.

## 22. Commit message

`feat(tasks): add persistent task lifecycle and mission control`
