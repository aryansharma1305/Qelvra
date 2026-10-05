# PR 16: Qelvra orchestrator verification

Verified locally on 2026-10-06 (client date), macOS arm64, Node 22.23.2. PR 15 baseline:
`7a275d69e23b483a265c8e502f6792d7c662eeea`. PR 17 has not started.

## 1. Files created

- `GLOSSARY.md`
- `apps/server/scripts/orchestration-smoke.ts`
- `apps/server/src/orchestration/agent-selection.ts`
- `apps/server/src/orchestration/index.ts`
- `apps/server/src/orchestration/orchestration-errors.ts`
- `apps/server/src/orchestration/orchestration-routes.ts`
- `apps/server/src/orchestration/orchestration-service.ts`
- `apps/server/src/orchestration/orchestration-store.ts`
- `apps/server/src/providers/provider-orchestration.ts`
- `apps/web/src/features/orchestration/useOrchestrations.ts`
- `apps/web/src/pages/tasks/GoalPanel.tsx`
- `docs/adr/0016-orchestrator.md`
- `packages/shared/src/orchestration.ts`
- `tests/design/orchestration-parity.ts`
- `tests/e2e/orchestration.spec.ts`
- `tests/fixtures/orchestration-cli.ts`
- `tests/integration/orchestration/crash-recovery.test.ts`
- `tests/integration/orchestration/orchestration.test.ts`
- `tests/unit/orchestration-schema.test.ts`
- `tests/unit/orchestration-selection.test.ts`
- `tests/unit/orchestration-store.test.ts`
- `docs/verification/pr16-orchestrator.md`

## 2. Files modified

- `README.md`
- `apps/server/.env.example`
- `apps/server/package.json`
- `apps/server/scripts/execution-bundle-smoke.mjs`
- `apps/server/src/activity/activity-routes.ts`
- `apps/server/src/activity/activity-store.ts`
- `apps/server/src/app.ts`
- `apps/server/src/config/env.ts`
- `apps/server/src/execution/agent-execution-service.ts`
- `apps/server/src/execution/execution-routes.ts`
- `apps/server/src/fake-agent/execution-cli.ts`
- `apps/server/src/providers/provider-execution.ts`
- `apps/server/src/tasks/task-registry.ts`
- `apps/server/src/tasks/task-routes.ts`
- `apps/web/src/features/activity/format-activity.ts`
- `apps/web/src/features/tasks/tasks-store.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/tasks/MissionControlHeader.tsx`
- `apps/web/src/pages/tasks/TasksPage.tsx`
- `docs/architecture/frontend.md`
- `docs/architecture/overview.md`
- `packages/shared/src/activity-event.ts`
- `packages/shared/src/api.ts`
- `packages/shared/src/execution-result.ts`
- `packages/shared/src/index.ts`
- `tests/design/parity.spec.ts`
- `tests/fixtures/execution-cli.mjs`
- `tests/fixtures/execution-server.ts`
- `tests/unit/activity-schema.test.ts`
- `tests/unit/server-config.test.ts`
- `tests/unit/web-activity.test.ts`

## 3. Goal schema

`OrchestrationSchema` separates goals from Task status: server-generated UUID identity,
title/description, orchestrator agent, draft/planning/planned/running/reviewing/paused/
completed/failed/cancelled, timestamps, plan, worker IDs/key mapping, decision-task IDs,
current decision, materialization marker, per-worker attempts/results/reviews, persisted
attempt limit, controlled error and validated final summary. Creation saves a draft
without starting any provider. Mapping/result identities are validated when persisted.

## 4. Plan schema

Strict `{summary, tasks}`. Each task has key, title, bounded description, preferredRole
and dependsOn keys. One to 20 unique tasks; no unknown fields, arbitrary agent IDs,
commands, nested task trees, missing prerequisites, duplicate dependencies or cycles.
Summary and each description are bounded to 1,024 UTF-8 bytes; roles to 120 bytes;
encoded plan to 14 KiB. Configuration can lower the task maximum. Invalid plans fail
visibly and can be regenerated before worker materialization.

## 5. Review schema

Strict `{decision: approve | rework | fail, reason, reworkInstructions}`. Reason and
instructions are bounded to 2,048 UTF-8 bytes; rework requires nonempty instructions.
Decision JSON comes through a validated `ExecutionResult.notes`, not a prose parser or
generic action interpreter. Decision tasks must report no changed files.

## 6. OrchestrationService API

`create`, `plan`, `run`, `cancel`, `resume`, `get`, `list`, `manages`, `recover`,
`stopAll`; `open` constructs it. REST uses `/api/orchestrations` GET/POST and `/:id`
GET, plus explicit POST `/:id/plan`, `/run`, `/start` (Run alias), `/cancel`, `/resume`.
Action bodies must be empty. Creation accepts only title, description and a known
orchestrator agent. Invalid bodies return 400; not found 404; domain conflicts 409;
storage errors 500, with controlled messages.

## 7. OrchestrationStore behavior

`DATA_DIR/orchestrations.json` is a strict version-1 atomic snapshot using existing
atomic-write machinery. Serialized writes commit disk before memory; reads return
clones. Missing file means empty state. Corrupt/unsupported/duplicate identities fail
closed. Failed persistence leaves the last committed memory snapshot intact. Fatal
scheduler persistence errors stop scheduling and clean active owned executions;
mutations stay blocked until repair/restart. This is not a cross-file transaction.

## 8. Agent selection algorithm

Only registered agents other than the selected orchestrator, with available, configured,
automation-capable providers and no required sign-in, are candidates. Bound roster to
50 in stable ID order. Normalize roles; exact match outranks meaningful role-word overlap
(excluding generic engineer/developer/senior/etc.), then free execution capacity, then
stable ID. Unrelated roles are never a fallback. Busy matching agents keep their
assignment and wait for capacity. An unavailable role leaves the approved plan retryable
with `ORCHESTRATION_NO_AGENT_AVAILABLE` and no worker tasks created.

## 9. Scheduler behavior

Committed TaskRegistry, execution and agent subscriptions coalesce scheduling through
a serialized service queue. There is no server polling loop, Redis or separate worker
queue. A single deadline timer enforces the goal wall-clock bound. Global orchestration
capacity defaults to three active executions, including decision tasks across goals;
configurable 1–5. Existing one automated execution per agent remains authoritative.
Busy conflicts wait without spending an attempt. Default one-hour deadline applies to
planning, Run and explicit Resume, including resumed interrupted planning.

## 10. Dependency semantics

Dependencies remain in the local plan. A prerequisite must be officially Completed
with a validated approved review before the dependent task starts. Independent worker
tasks on different agents can overlap. TaskRegistry remains a simple lifecycle registry.

## 11. Task materialization

Run resolves every role and durably reserves all server-generated worker IDs before
creating tasks. It calls normal TaskRegistry.create/assign and persists key-to-ID mapping;
Mission Control shows the same tasks. A server-only optional reserved ID makes create
idempotent after partial storage failures; browser input cannot choose IDs. Partial
materialization is visible, executes no workers and can be repaired with explicit Resume
using the same IDs. Concurrent duplicate Run calls cannot materialize twice.

## 12. Execution integration

Planning, each review and final summary are ordinary decision tasks assigned to the
orchestrator. Workers and decisions all call AgentExecutionService.executeTask, reuse
provider admission, managed cwd, fixed arguments/environment, watchdog, cancellation,
MailboxManager and MessageRouter. Decision context is server-owned and bounded to
48 KiB; no orchestration process-launch stack or direct workspace writes exist.
The architectural audit and tradeoffs are recorded in ADR 0016 and GLOSSARY.md.

## 13. Review behavior

PR 15 validated results move Working → Review. The orchestrator receives only bounded
parent-goal, planned-task and correlated result data, including up to 20 file claims.
Validated approve calls TaskRegistry.complete; fail uses the official fail transition
and stops the goal. Goal completion requires every required worker task Completed,
then a validated final summary with the exact worker IDs and known agent/file claims.
Provider reports are not independent verification that the implementation is correct.

## 14. Rework behavior

Review → Working uses TaskRegistry.start, followed by explicit execution with reviewer
instructions. UTF-8 chunks respect the existing instruction limits. The prior review
reason remains visible while the new attempt runs; approved replacement results complete
the same real task. Recovery reconciles durable reviews before further scheduling.

## 15. Attempt limits

Default three worker execution attempts, configurable 1–3 and persisted on each goal.
No fourth attempt. Launch/unavailable/timeout/interruption can retry within the bound;
invalid output, required authentication and semantic rejection stop for intervention.
Decision-history count is capped at 100, avoiding unlimited replanning. Planner failure
is explicitly retryable before workers are materialized; failed review/summary needs
human attention rather than an uncontrolled decision loop.

## 16. Cancellation

Persist cancelled first, stop future scheduling, cancel owned active executions through
PR 15 and await cleanup. Completed tasks, other agents' work and workspace files remain.
Active tasks return to retryable assignment; tasks/workspaces are not deleted. Failed
goals also stop their active work. Live user Pause is deferred; there is no fake control.

## 17. Restart recovery

Execution recovery runs first. Unfinished goals become Paused and require explicit
Resume; no hidden launches. Resume reuses reserved task/decision IDs, reconciles committed
results and retains attempt bounds. Planning Resume resets its deadline correctly.
Graceful shutdown pauses before execution cleanup; a finally block still cleans executions
if goal persistence fails. A real SIGKILL integration test verifies watchdog descendant
and temporary-directory cleanup, Paused recovery, unchanged IDs and zero automatic work.

## 18. Security boundaries

Strict plan/review/summary schemas reject commands and foreign identities. Browser actions
cannot supply executable/argv/cwd/env/plan overrides. Provider decisions are data; the
server performs only fixed validated domain operations. Existing execution correlation
rejects Atlas spoofing Nova. Goal-owned tasks are protected from competing manual
mutations, including while paused; cancel releases ownership. No shell injection, direct
inbox writes, cross-agent workspace copying or direct task-status assignment is added.
Native provider isolation retains PR 15 limits: cwd alone is not a filesystem sandbox.

## 19. UI integration

Mission Control’s Goals view: `/tasks?view=goals&goal=<id>`. New Goal → save draft →
Generate Plan → inspect task breakdown → Run Plan → live status → final summary.
Actual task counts, assignment/provider, worker attempts, review reasons, recovery and
controlled errors; links reuse the real task inspector and agent profiles. Activity events
coalesce refreshes, with a two-second fallback only while any goals are active. Real
empty/loading/error states, focus and native form controls use incumbent Stitch tokens.
Phone Goals content occupies the full available width below the existing header.
Primary controls use a readable lavender hover surface. UI detector returned no findings.

## 20. Activity integration

Twelve orchestration event types, including creation/planning/planned/started/task start/
approval/rework/completion/failure/cancel/pause/resume. Existing formatter adds concise
labels and goal links. Filters include orchestration entities and task/agent metadata.
Publisher payloads contain IDs, attempts and controlled codes, never goal descriptions,
prompts, results, reviewer text, environment secrets or raw provider output. Domain
scheduling uses committed subscriptions independently of Activity persistence.

## 21. Fake orchestration tests

Real services, fake CLI provider adapter: normal two-worker plan/run/review/summary,
explicit approval, managed API protections, invalid plan/review/summary, missing role,
foreign result, transient retry, task ownership, timeout, restart and partial persistence.
No domain registry/execution/mailbox/router mocks. Production fake planning/review/summary
uses the same provider adapter and mailbox stack; test-only scenario directives stay in
fixtures. Source and shipped-bundle smoke both complete actual fake goals and clean up.

## 22. Dependency/parallel tests

Dependency waits for approved Completed prerequisite. Parallel test uses overlapping
active execution state, not fragile millisecond comparisons. Cap-one test proves serialized
work. Busy-agent test holds an unrelated real execution open and proves scheduling waits.
Stable role/tie-break unit tests reject unsuitable candidates.

## 23. Rework tests

First rejected result produces rework, second attempt approves and completes. Repeated
rejection stops at attempt three; attempt four never exists. Browser demonstrates Attempt
2 / 3 and a completed final summary. Transient provider failure succeeds on bounded retry;
invalid worker output stops after one attempt.

## 24. Browser E2E

75/75 passed with one worker and zero retries (1.7 minutes), including both new full-stack
Goal → Plan → Run → Complete/live Activity/task-inspector and rework flows. Multi-phase
new workflows have a scoped 60-second budget; global retries/timeouts were not increased.

## 25. Real-provider smoke

Authenticated Codex 0.160.0 served as the real orchestrator for planning, two reviews and
summary. Nova/Atlas used deterministic fake workers. Two validated workers, zero workers
before explicit Run, both approved/Completed, validated summary and actual workspace
artifacts, zero provider processes/PTYS, empty system mailbox, unchanged project file
fingerprint and removed disposable DATA_DIR. This verifies native decisions with fake
workers, not a claim of a full all-native multi-agent application build. No credential
setup/install or provider argument changes were needed; Kite remained untouched.

## 26. Repeated-run results

Five consecutive final runs passed: **28/28 each**, across five files. Durations:
87.99s, 61.57s, 58.99s, 58.34s and 58.93s. Normal, overlap, dependencies, rework,
attempt cap, cancellation, duplicate Run and provider failure ran in every repetition.

The final focused suite includes 28 tests across five files, including real hard-server
crash recovery and resumed-planning deadline coverage. An earlier five-pass run preceded
the discovered deadline correction and is not counted as final evidence.

## 27. Full tests

620/620 tests across 53 files passed (90.91 seconds). Format, ESLint, workspace/test typecheck,
and all workspace/worker/fake bundles build passed. No broad timeout/retry relaxation,
skipped domain validation or weakened test assertions was used.

## 28. Design parity

42/42 passed (3.4 minutes), preserving incumbent reference masks/tolerances. Additional
real fake-provider plan and summary evidence covers desktop and 390px phone, real
assignments and artifacts, no detail overflow and summary scroll reachability. A focused
confirmation waits for the existing completion-bar transition rather than disabling it.
Three additional Tasks design checks passed (31.3s) after the hover correction.
A fresh read-only reviewer approved both scored fixes: primary hover contrast and
settled completion evidence. Runtime colors for New Goal/Create Goal/Run Plan were
background rgb(160,120,255), foreground rgb(60,0,145).

Final cleanup found no disposable data directories, test workers, native task providers
or PTYs. An orphan fixture from an intentionally interrupted earlier repeat was
explicitly terminated. Developer localhost remains healthy; Kite retains its original
stopped state/provider-null record, and developer tasks/goals are empty.

## 29. Known limitations

- Separate agent workspaces: no copying, merging, shared project or integrated app validation.
- Decision tasks add normal records to Mission Control; global task metrics include them.
- Automatic review judges bounded reported results; file claims are not a workspace audit.
- Review/summary contexts intentionally include only bounded snippets and up to 20 files per worker.
- Native adapter capabilities/isolation remain PR 15’s locally verified scope; fake is development/test only.
- No live Pause, generic tools, recursive planner expansion, dashboard redesign or PR 17 work.
- Snapshots are not cross-file transactions; reserved identities plus explicit recovery handle partial writes.

## 30. Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
for attempt in 1 2 3 4 5; do
  npx vitest run tests/unit/orchestration-schema.test.ts tests/unit/orchestration-store.test.ts tests/unit/orchestration-selection.test.ts tests/integration/orchestration --maxWorkers=1
done
CI=1 npm run test:e2e -- --workers=1 --retries=0
CI=1 npm run test:design -- --workers=1 --retries=0
CI=1 npm run test:design -- --workers=1 --retries=0 --grep tasks
npm run orchestration:smoke -w @qelvra/server -- fake
npm run orchestration:smoke -w @qelvra/server
npm run execution:bundle-smoke -w @qelvra/server
```

Long-running local checks used macOS `caffeinate -i` to prevent laptop sleep. The UI
detector ran once over changed Tasks UI and orchestration hook files. The source smoke
and bundle smoke use disposable data and remove it in finally blocks. Native smoke was
run without concurrent source edits; no paid provider was required for CI.

## 31. Commit SHA

Implementation: `c753661fbeddd821c1ab718058e017ba6f6a801d`.

[Implementation commit](https://github.com/aryansharma1305/Qelvra/commit/c753661fbeddd821c1ab718058e017ba6f6a801d).

## 32. GitHub CI result

[Implementation CI run 37384853536](https://github.com/aryansharma1305/Qelvra/actions/runs/37384853536)
passed for exact SHA `c753661fbeddd821c1ab718058e017ba6f6a801d`: both **check**
and **e2e** completed successfully. GitHub tests used fake providers; native smoke
remains the separately verified local scope above.

The verification report is committed separately to avoid a self-referential commit SHA.
The completion handoff identifies the final documentation HEAD and its own CI result.

## 33. Suggested commit message

`feat(orchestration): add multi-agent goal orchestration`
