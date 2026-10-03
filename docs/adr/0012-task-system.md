# ADR 0012: Persistent tasks and Mission Control

- Status: Accepted
- Date: 2026-10-04

## Decision

A Task is a server-owned workflow record independent of agent processes and mailbox
messages. `TaskRegistry` owns it; Mission Control reads validated REST responses.
No production demo tasks are seeded.

The strict shared Zod record has `id: task-<UUID v4>`, trimmed printable `title`
(1–160 characters), `description` (0–16 KiB UTF-8; tabs/newlines allowed, invalid
control characters rejected), `status`, `assignee: AgentId | null`,
`createdBy: "user"`, and ISO UTC `createdAt` / `updatedAt`. Inbox has a null assignee;
every other state has an ID, which can be a historical reference after deletion.
Creation sets equal timestamps; every committed mutation advances updatedAt even
under a frozen/backward clock or after restart. Rejected actions leave timestamps
unchanged. Description is displayed as plain React text.

IDs, status, author and timestamps come from the server. Creation strips unknown
fields; assignment accepts only agentId; lifecycle endpoints accept no task fields.
There is no general PATCH, task deletion, editing, unassignment or retry API yet.

## Lifecycle and assignment

```text
inbox ──assign──▶ assigned ──start──▶ working ──review──▶ review ──complete──▶ completed
                                  ▲                    │
                                  └──────start─────────┘
assigned / working / review ──fail──▶ failed
```

Completed and Failed are read-only terminal states. Assignment requires an existing
task and registered agent, and is allowed only from Inbox. It does not require or
start a running agent. Return from Review reuses Start. Active means Assigned,
Working or Review. Invalid transitions return controlled conflicts rather than
silently accepting/no-op writes.

Transport-independent methods are `open`, `create`, `get`, `require`, `list`,
`assign`, `start`, `review`, `complete`, `fail`, `deleteAgent` and `subscribe`.
Subscription emits task.created, task.assigned, task.started, task.review_requested,
task.completed, task.failed and task.unassigned only after persistence. Creating
with an assignee emits created then assigned. Consumers receive frozen snapshots;
listener exceptions cannot undo commits. This is an internal callback, not an event
store or an Activity subsystem. Startup orphan repair emits no retrospective events.

## Persistence and concurrency

`DATA_DIR/tasks.json` is a strict version-1 snapshot `{version: 1, tasks: [...]}`.
Missing file means an empty registry; invalid JSON, invalid tasks, unknown version
or duplicate IDs refuse startup without overwriting the file. Listing and persisted
snapshots sort by createdAt ascending, then ID. The existing atomic writer writes an
exclusive temporary sibling, fsyncs the file, renames and best-effort fsyncs the
parent directory. Failed publication removes the temporary file.

A single promise queue serializes all mutations and deletion coordination because
all tasks share one file. Changes use a cloned map; reads/events see only committed
state. Persistence failure preserves the previous disk/memory snapshot, returns
TASK_PERSISTENCE_FAILED, and leaves the queue usable. One server process owns DATA_DIR;
multiple independent writers and a database are deliberately deferred.

## Agent deletion

The composed AgentRuntimeManager deletion path first stops the runtime, then invokes
TaskRegistry.deleteAgent. Within the task queue, Assigned/Working/Review tasks owned
by the agent are moved to Inbox with null assignee and a new timestamp. Title,
description and createdAt are preserved. Completed/Failed retain the original
assignee ID as history; UI resolves a missing agent as `<id> (deleted)`.

Task cleanup commits before agent metadata deletion. If task persistence fails, the
agent is not deleted (its runtime may already have stopped). If agent persistence
fails, restore the old task snapshot; if restoration also fails, the safer committed
Inbox tasks remain and deletion reports a controlled persistence error. No data is
lost. Workspace/mailbox files retain their established preservation semantics.

Two separate JSON files cannot form a fully atomic transaction. A crash after task
cleanup but before agent deletion can leave Inbox tasks and a still-registered agent;
that state is valid and permits reassignment. Startup repairs active tasks pointing
to missing agents and persists that repair before serving requests. Direct internal
AgentRegistry.delete bypasses coordination and should not be used by new consumers;
REST and runtime rollback use the coordinated path. Terminal historical references
are intentionally not repaired. These limits do not claim cross-process locking.

## API and UI

- GET /api/tasks; POST /api/tasks; GET /api/tasks/:id
- POST /api/tasks/:id/assign with `{agentId}`
- POST /api/tasks/:id/start, /review, /complete, /fail without task fields

Creation accepts title, optional description (default empty) and optional nullable
assignee. Success returns `{task}` (201 for creation); list returns `{tasks}`.
Malformed ID/input is 400, missing task 404, invalid transition/already assigned 409,
and persistence failure 500 with no filesystem details. Error codes include
TASK_INVALID_ID, TASK_INVALID_TITLE, TASK_INVALID_DESCRIPTION, TASK_AGENT_NOT_FOUND,
TASK_NOT_FOUND, TASK_ALREADY_ASSIGNED, TASK_INVALID_TRANSITION and
TASK_PERSISTENCE_FAILED. Malformed JSON uses the existing BAD_REQUEST envelope;
malformed assignment bodies use VALIDATION_ERROR.

The centralized web client validates every response with the shared schema. A small
external store follows the Agents pattern: load/error/retry, stable sorting, mutation
upsert, pending controls, stale-list cancellation and conflict refetch. Page entry
and Refresh fetch current tasks and agents. There is no polling/global realtime bus.

Mission Control keeps the original typography, colors, metric strip, five columns,
320px column width, card chrome and 480px inspector. Failed appears as an additional column when present and has a dedicated filter.
Create Task and the inspector are functional; select pickers use real registered
agents. Empty state is honest. Cards display title, description, status, assignee
and updated date; inspector shows full timestamps and author. Metrics are total,
Inbox, active, Working, Review, Completed and Failed counts; the completion bar is
completed/total. Unsupported priority, per-task progress, elapsed duration,
dependencies, subtasks, telemetry, artifacts, transmission history and velocity are
removed. Unsupported List/DAG views are disabled. Global shell hardware telemetry
and other pages' design mocks remain outside this PR.

## Deferred execution

Assignment does not send a mailbox message or launch AI. Fake-agent ACK/DONE results
are not task-state authority. A future orchestrator can subscribe and call explicit
TaskRegistry actions, with a separately validated task/result bridge; arbitrary
agent output must never write status. No provider integration, scheduler, dependency
graph, estimates, recurring tasks, persistence event store or PR 13 work is included.
