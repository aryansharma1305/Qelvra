# PR 23 — Real Automations: source audit and proposed scope

Status: source audit complete; implementation not started.
Branch: `codex/pr23-real-automations`.
Baseline: `main` at `beb121d167452df463c7394d85d859739c0d46b1` (merged PR 22, including the pre-merge refresh correction).

## Existing boundaries

- `apps/web/src/app/router.tsx` maps `/automations` to `EmptyStatePage`.
  There is no automation page, client store, contract, scheduler or automation persistence.
- `packages/shared/src/provider.ts` exposes `capabilities.automation`.
  This means noninteractive task execution support, not a schedule or trigger system.
- `ProviderRegistry.resolveExecution` and `AgentExecutionService.executeTask`
  already enforce provider availability, authentication, execution support,
  task assignment, agent exclusivity, timeout and shutdown boundaries.
- `TaskRegistry.create(input, reservedId)` supports durable server-only task
  identities and idempotent creation. Fresh tasks can reuse the existing execution
  and human review lifecycle. Completed tasks should never be recycled as schedules.
- `ExecutionStore` and execution subscriptions preserve correlated results and
  terminal outcomes. Execution success moves a working task to review; it does
  not approve or complete the task for the user.
- `writeFileAtomic` and startup validation support versioned, bounded private
  snapshot files. They do not provide cross-process transactions or launch guarantees.
- Activity uses strict event metadata allowlists and bounded retained history.
  A schedule needs authoritative configuration/run records, not inference from Activity.
- Orchestration already owns its materialized tasks, planning/review and recovery.
  Scheduled goal execution would require additional approval semantics and is a
  separate scope decision.

## Recommended first scope

Scheduled task templates assigned to an existing agent. Keep scheduled goals,
Activity/file/message triggers, arbitrary shell commands, provider secrets,
shared projects and external notification integrations out of this first slice.

Use explicitly enabled local schedules, defaulting new automations to disabled.
Recommend one-time UTC timestamps and fixed recurring intervals first; no cron
parser or timezone/DST editor dependency. Scheduling only runs while the local
Qelvra server is running, and missed periods do not produce catch-up bursts.

Each run creates a fresh task from the saved template, assigns its configured
agent and invokes the existing execution service. Link automation/run/task/
execution identities durably. Show execution success as awaiting task review;
never automatically approve a task or merge workspace changes.

## Decisions to pin before implementation

The human has been asked whether PR 23 should target scheduled agent tasks,
scheduled tasks and goals, or remain at audit/plan first. This document recommends
tasks first; it does not invent approval for scheduled orchestration.

Pin supported cadence limits, missed-run policy, overlap policy, bounded history,
and crash recovery in ADR 0023 and shared schemas before exposing editable controls.
A safe initial policy is one automated execution in flight, no catch-up backlog,
and explicit skipped/blocked outcomes for busy agents or unavailable providers.
Manual Run now should follow the same persisted admission path as scheduled runs.

## Implementation seams

1. Add strict shared automation/configuration/run schemas and fixed error codes.
   Bound template input and list/history sizes; validate unknown fields, IDs,
   future timestamps and interval limits. Link run attribution without changing
   historical task records or misrepresenting AI output as reviewed work.
2. Add a versioned atomic automation registry under `DATA_DIR`, plus startup
   validation that fails safely on corrupt or unsupported files. Preserve every
   existing store, user memory and the released beta tag.
3. Add a clock-injected scheduler that persists a run reservation and reserved
   task ID before dispatch. Use the existing task/execution services. Persist the
   next due time before work and define downtime and clock-jump behavior.
4. Guard duplicate admission and overlapping schedules. Do not claim exactly-once
   external execution. An ambiguous crash/launch boundary must become interrupted
   and require user action, rather than silently relaunching paid AI work.
   Define ownership for a second server using the same `DATA_DIR`; atomic rename
   alone is insufficient to prevent two schedulers dispatching the same run.
5. Add real CRUD/enable/disable/Run now/run-history routes. Reads have no scheduling
   side effects or provider probes. Disabling stops future admissions; distinguish
   that action from cancelling an already running task.
6. Add allowlisted automation Activity events and refresh integration. Keep task
   descriptions, provider credentials and execution output out of event metadata.
   Reuse Activity transport and existing execution notifications instead of adding
   another WebSocket protocol or telemetry store.
7. Replace the placeholder with a page using Qelvra's existing shell and tokens.
   Show actual enabled state, next due UTC time, server-only scheduling limitation,
   last real result, agent/provider support and bounded run history. Link existing
   tasks and results; use native forms and accessible mobile/error/recovery states.
8. Add ADR 0023, verification evidence and narrowly necessary README/architecture
   updates. All editable settings must persist and have a real scheduler consumer.

## Required verification

- Fake clock: exact UTC boundaries, intervals, missed periods, clock jumps,
  no overlap, disable, restart and shutdown cleanup.
- Persistence: reserved task/run identities, crash boundaries, ambiguous launches,
  duplicate Run now requests and a second process against the same storage.
- Existing services: deleted agents, unsupported providers, auth/availability
  failures, busy agents, timeouts, cancellation and real Fake-provider execution.
- Human review: successful scheduled work lands in review and remains unapproved.
- Privacy: strict event/API allowlists, no prompt/secret logging and unchanged user data.
- Browser: CRUD, persisted enable/disable, real next-due/run results, keyboard,
  mobile, errors and restart persistence using disposable storage.
- Repository format/lint/typecheck/unit/build, E2E/design/release and smoke checks;
  hosted CI must pass on the exact implementation PR head before merge.

PR 24 Shared Projects/Git worktrees is deferred. No scheduler, automatic task,
provider invocation or new persistence is enabled by this audit commit.
