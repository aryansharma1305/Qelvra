# ADR 0023: Persistent local scheduled agent tasks

Status: Accepted (v0.2 development)

## Scope and cadence

Automations persist a task template assigned to a registered agent. They support
one-time UTC timestamps and fixed whole-minute intervals of **5 minutes–30 days
(43,200 minutes)**, anchored to the first UTC occurrence. The lower bound avoids
tight paid-execution loops; the upper bound keeps this scheduler deliberately
simple and inspectable. New templates are disabled. First timestamps on create
or edit must be future times. Enable calculates the next strictly future slot;
Run now is independent of cadence and also works on disabled/expired templates.

Only a running local server schedules work. The scheduler wakes every second,
uses an injected UTC clock, and admits due slots within a 60-second grace period.
After a longer delay, forward clock jump or downtime, one skipped record counts
all missed occurrences and advances to the next strictly future anchored slot.
Startup skips any already-past slot, even within grace. An exactly-due startup
slot is considered by the next normal tick. Backward clock jumps do not rewind
persisted next-due times. No catch-up queue or execution burst is created.

## Persistence and admission

`DATA_DIR/automations.json` is a private, atomic, strict version-1 snapshot with
at most 100 automations and 500 run records globally. History reads expose at
most 50 records. Trimming keeps each automation's latest run and every active
reservation, then the newest remaining records. Lifetime record counts and
truncation are explicit. Skipped summaries count records separately from missed
occurrences. Delete removes configuration/history but retains generated tasks.

All mutations and scheduler ticks share one admission queue. Every admitted run
atomically reserves a server-generated run ID, a fresh task ID, its template's
revision and next due time **before** task creation or provider dispatch. A run
ordinal preserves same-timestamp ordering. A failed reservation write never
launches work. A failed later scheduler write stops scheduling until repair and
restart. Files remain authoritative; Activity is observational.

Run now takes the current persisted `revision`. Concurrent/retried requests with
that same revision return its existing retained manual run. If it has been
trimmed, the stale revision conflicts rather than dispatching again. Updates,
enable/disable and delete also require a matching revision. There is no unbounded
idempotency-key ledger. A deliberately new run requires the refreshed revision.

One automation execution is admitted globally at a time. Overlapping scheduled
slots, including agents busy with manual/goal executions, are recorded as skipped
and advanced, without queueing. Manual global overlap returns 409; a later
provider/agent admission rejection records a failed fresh task. Deleted agents
cannot be selected; a previously saved deleted agent causes a recorded skip and
disables that schedule. Failure disables scheduling to prevent paid retry loops.

## Execution and human review

Fresh tasks pass through the existing `TaskRegistry` and `AgentExecutionService`.
Provider support, availability, authentication, exclusive agent admission,
process supervision and configured timeouts remain owned by that service.
Success is a historical run outcome **Awaiting human review**, with the task in
Review. Human completion is never automatic. Future intervals may create another
fresh task while earlier results await review; reviewers should consider shared
edits within that agent's isolated workspace.

Disable only stops future scheduling. Cancel active execution from Tasks. Editing
requires disabled scheduling and no active run; deletion requires no active run.
Restart correlates active reservations against recovered executions: an already
durable success is recognized without relaunch; anything ambiguous becomes
interrupted, disabled and marked needs-attention. Enable or Run now then requires
explicit acknowledgement. New work has new identities. Workspace edits survive
interruption and may be repeated by a human-authorized retry. Exactly-once paid
AI execution is **not guaranteed** across independent stores and external CLIs.

## Cross-process ownership and shutdown

Every server claims an atomic `.server-owner` directory under canonical DATA_DIR
**before preflight or recovery**. A private token and directory identity guard
release. A second server fails closed, including servers that would otherwise
only serve reads. A clean shutdown stops scheduler admission, drains dispatch,
stops orchestration/executions, records interruptions, stops routing/runtimes,
closes Activity and releases ownership. Cleanup failure retains the claim.

Hard crashes retain the claim. There is intentionally no PID guessing, stale
lease theft or automatic deletion. Before moving `.server-owner` aside, the
operator must verify that **all** Qelvra servers and provider descendants using
this DATA_DIR have stopped, and back up the entire stopped-server directory.
Restart then performs interruption recovery. This cooperative lock requires a
local filesystem with atomic mkdir/rename semantics and current Qelvra servers;
network/cloud-synced storage and older servers that ignore the claim are not
supported for concurrent use. Losing a lock must never authorize a second live
scheduler. Do not remove a live owner's claim.

## API, UI and privacy

Strict `/api/automations` CRUD, enable/disable, Run now and bounded history routes
reject unsupported controls, malformed IDs, offsets, unsafe intervals and stale
revisions. GETs are no-store and never probe providers or dispatch work.
`/automations` shows persistent templates, registered agent links, UTC cadence,
enabled state, next due, last outcome, retained history, generated task links,
controlled errors and explicit interruption acknowledgement. Visible-page polling
refreshes every five seconds; hidden/unmounted pages stop reads/timers.

Automation Activity includes IDs, trigger outcome status, controlled error code
and missed count only. It excludes titles, instructions, output and credentials.
Automation-created tasks have the additive persisted `createdBy: automation`
origin; their existing task Activity uses the generic label `Automation task`,
even after history trimming or automation deletion. Existing user tasks remain
`createdBy: user`; there is no historical rewrite. Older builds can reject the new task-origin value;
rollback after automated tasks exist requires a compatible build or a stopped-server
backup restore. No new WebSocket protocol,
telemetry store, credential handling, generic scripts or shell API is added.

Scheduled goals, cron, event triggers, integrations, shared projects and PR 24
are deferred. The released `v0.1.0-beta.1` tag is unchanged.
