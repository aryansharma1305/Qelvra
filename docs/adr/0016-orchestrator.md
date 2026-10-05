# Coordinate goals through ordinary tasks and executions

The orchestrator is an ordinary configured agent. Planning, review, and final-summary
decisions are real TaskRegistry tasks assigned to that agent and executed through
AgentExecutionService, including PR 15 mailbox transport, correlation, bounded output,
provider admission, workspace policy, cancellation and cleanup. There is no second
provider launch stack or generic AI action interpreter. This makes decision tasks visible
in Mission Control alongside worker tasks, at the cost of additional task records.

Goals persist separately in atomic version-1 orchestrations.json snapshots. Create, Plan,
Run, Cancel and Resume are explicit; creation does not launch providers. Plans have
at most 20 unique tasks, valid acyclic prerequisites, bounded text and a 14 KiB encoded
limit. Decision JSON is carried in the existing validated ExecutionResult.notes field;
the orchestration schemas validate it before any domain action.

Agent selection considers only available, configured automation providers and known
agents other than the orchestrator, up to 50 in stable ID order. Exact roles rank first,
then overlapping meaningful role words, available capacity, and stable agent ID. No
matching role yields a controlled intervention error. Busy suitable agents retain their
assignment and wait for committed domain events. A service-wide cap defaults to three
active orchestration executions, including decisions. One execution per agent remains
enforced by AgentExecutionService.

All worker IDs and assignments are durably reserved before serial materialization.
TaskRegistry.create accepts these server-only reserved IDs idempotently, and assign
uses the official lifecycle. A partial storage failure is visible with its reserved
mapping and no worker scheduling; explicit Resume completes materialization without
duplicate tasks. Snapshots are not a cross-file transaction.

Task and committed execution subscriptions coalesce scheduler work; no scheduler
polling interval is used. Prerequisites must be approved and Completed before dependent
work starts. Execution success remains Working → Review. Validated approval calls
TaskRegistry.complete; rework calls the supported Review → Working transition and a
new explicit executeTask with bounded reviewer instructions. At most three worker
attempts are allowed. Transient timeout/launch/unavailability/interruption can retry;
invalid output, auth requirements and semantic failures stop for intervention.

Review and summary receive bounded goal/result data, not unrelated file contents.
No AI-produced commands, IDs, cwd, env or arbitrary actions are accepted. Summary
task IDs must exactly match completed worker tasks; artifact agent/file claims must
match their validated execution results. Activity contains only IDs, attempts and safe
error codes. Task APIs protect active or paused goal-owned tasks against competing
manual actions; cancelling the goal releases that ownership.

The default one-hour run deadline cancels scheduling and active executions, preserves
completed tasks and leaves other work retryable. Cancellation preserves tasks and
workspaces. Shutdown pauses goals before PR15 execution cleanup. Startup first runs
PR15 recovery, then pauses unfinished goals; explicit Resume reconciles existing tasks,
executions and durable decisions, never blindly duplicates a launch.

All work stays in isolated per-agent workspaces. Final summaries reference those
workspaces; this milestone does not merge code or validate an integrated application.
Cwd alone is not a filesystem sandbox; native provider limitations from ADR 0015 apply.
Human approval of a plan authorizes its bounded automated review/completion policy.
Pause during a live run, workspace merging and PR17 intelligence are deferred.
