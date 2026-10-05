# PR 15 verification: real AI task execution

Date: 2026-10-05. This milestone implements explicit provider-backed workspace work
and human review. PR 16/orchestrator intelligence is not implemented.

## 1. Files created

- `apps/server/src/execution/agent-execution-service.ts`
- `apps/server/src/execution/execution-errors.ts`
- `apps/server/src/execution/execution-process-manager.ts`
- `apps/server/src/execution/execution-result-handler.ts`
- `apps/server/src/execution/execution-routes.ts`
- `apps/server/src/execution/execution-store.ts`
- `apps/server/src/execution/execution-worker.ts`
- `apps/server/src/execution/index.ts`
- `apps/server/src/providers/provider-execution.ts`
- `apps/server/src/fake-agent/execution-cli.ts`
- `apps/server/scripts/execution-smoke.ts`
- `apps/server/scripts/execution-bundle-smoke.mjs`
- `apps/web/src/features/tasks/useTaskExecution.ts`
- `apps/web/src/pages/tasks/TaskExecutionDetails.tsx`
- `packages/shared/src/execution-result.ts`
- `tests/fixtures/execution-cli.mjs`
- `tests/fixtures/execution-server.ts`
- `tests/integration/execution/execution.test.ts`
- `tests/integration/execution/crash-recovery.test.ts`
- `tests/unit/execution-result.test.ts`
- `tests/unit/execution-store.test.ts`
- `tests/unit/execution-process.test.ts`
- `tests/e2e/execution.spec.ts`
- `docs/adr/0015-real-ai-execution.md`
- This report

## 2. Files modified

- `apps/server/package.json`, `apps/server/scripts/build.mjs`
- `apps/server/src/app.ts`, `apps/server/src/config/env.ts`
- `apps/server/src/agents/agent-registry.ts`
- `apps/server/src/fake-agent/behavior.ts`
- `apps/server/src/mailbox/mailbox-manager.ts`
- `apps/server/src/router/message-router.ts`
- `apps/server/src/pty/process-tree.ts`
- `apps/server/src/workspaces/agent-workspace-manager.ts`
- `apps/server/src/providers/provider-{types,detector,registry}.ts`
- `apps/server/src/tasks/task-{registry,routes}.ts`
- `packages/shared/src/{api,index,provider,activity-event}.ts`
- `apps/web/src/lib/api.ts`, `apps/web/src/features/tasks/tasks-store.ts`
- `apps/web/src/features/activity/format-activity.ts`
- `apps/web/src/pages/tasks/TaskInspector.tsx`
- `playwright.config.ts`
- `tests/design/{parity.spec,task-parity,activity-parity}.ts`
- `tests/unit/{provider-detector,activity-schema,server-config,web-activity}.test.ts`
- `tests/integration/server/agent-workspaces.test.ts`
- `tests/integration/activity/activity.test.ts`
- `README.md`, `docs/architecture/{overview,frontend}.md`

## 3. AgentExecutionService API

`executeTask(taskId)` admits explicit work and returns execution metadata. `get(taskId)`
returns the latest execution/result. `cancelTask(taskId)` aborts and waits for cleanup.
`recover()` processes durable results before interrupting unfinished work. `scanResults()`
validates delivered control results. `isActive(taskId)` protects task actions, including
pending admission; `deleteAgent(id, remove)` coordinates cancellation with deletion;
`stopAll()` drains shutdown. No AI/provider mutates TaskRegistry.

HTTP: POST `/api/tasks/:id/execute` (202), POST `cancel-execution` (200), GET `execution`
(200). POST bodies are empty strict objects; arbitrary executable/args/cwd/command input
is rejected. Controlled validation/not-found/conflict/persistence errors remain retryable.

## 4. Execution model/schema

Strict shared `ExecutionSchema`: UUID execution ID, task/agent/provider, one of starting,
queued, running, awaiting_result, succeeded, failed, cancelled, interrupted, nullable
request/result message IDs, timestamps, controlled error code and validated result.
An atomic version-1 `DATA_DIR/executions.json` snapshot contains only this metadata.
No prompt, environment, raw stdout/stderr or unbounded logs are persisted.

## 5. ExecutionResult schema

Strict JSON fields: executionId, requestMessageId, taskId, agentId, status completed/failed,
summary, changedFiles, nullable notes. Limits: summary 8 KiB, notes 16 KiB, 200 files,
512 characters per path and 60 KiB total JSON. UTF-8 byte limits are enforced. Paths
reject traversal, absolute/drive/UNC paths, empty/dot components, controls and backslashes.
Reported changed files are claims; no diff, file reading API or trusted hyperlink is implied.

## 6. Provider automation capability model

All descriptors explicitly expose interactive/automation. Codex and development/test fake
have adapters; shell, Claude Code, Gemini, OpenCode and Ollama remain interactive-only.
Codex automation is enabled only after its help advertises all required options. A failed
or incompatible automation probe preserves interactive availability. Windows automation
is disabled until tree supervision is verified; this PR validates macOS and Ubuntu CI.
Fake remains disabled in production. Authentication/configuration/availability checks run
before task mutation. Native login is never performed automatically.

## 7. Task request format

The existing `task` envelope carries strict JSON `kind: qelvra.task.v1`, executionId,
taskId, agentId, title, description, `workspace: .` and bounded fixed instructions.
The envelope message ID provides request correlation; no absolute path appears in the body.
The coordinator verifies the delivered system sender, intended agent, type and identities.
Agent name/role plus at most 8 KiB of existing agent.md enter the controlled prompt;
agent.md is preserved and memory.md is not automatically included or modified.

## 8. Result transport

Control task: system outbox → existing MessageRouter → assigned agent inbox.
Validated provider response: agent outbox → existing MessageRouter → system inbox →
result handler/coordinator → server-owned Review transition. `system` is a reserved
control mailbox under hive/system, with no AgentRegistry record. No router/provider bypass.
The existing fake inbox processor ignores only reserved structured execution requests;
ordinary fake messaging and interactive terminals continue to work.

## 9. Result correlation

Acceptance requires matching expected/current assignee, envelope sender/recipient,
result agentId, taskId, executionId and requestMessageId, plus eligible task/execution state.
Pure unit tests reject spoofed senders/owners, wrong task/request/execution, stale IDs,
invalid JSON/schema/paths and duplicate success. Integration verifies durable startup
result acceptance and duplicate acknowledgment without a second transition/completion event.
Malformed/stale/duplicate results are safely rejected/acknowledged without logging their body.

## 10. Task transition behavior

Assignment starts nothing. Explicit Execute moves Assigned → Working. Only a validated,
correlated successful mailbox result moves Working → Review. Success never auto-completes.
Failure/cancellation/interruption return Working → Assigned. Human Complete and Return
to Working remain; returning does not run a provider until another explicit Execute.
Manual task state changes are blocked during admission/active execution. Content/assignee
and existing workspace edits are preserved for retry.

## 11. Timeout policy

EXECUTION_TIMEOUT_MS defaults to 20 minutes; configuration permits 1 second–30 minutes.
The deadline covers dispatch, provider work and result handling. Timeout aborts and
terminates the process tree, persists EXECUTION_TIMED_OUT and returns the task to Assigned.
The timeout integration fixture uses 3 seconds so actual worker startup precedes the check.

## 12. Cancellation policy

Cancel only applies to unfinished executions; inactive cancellation returns a controlled
conflict. Active cancellation aborts and awaits the worker/provider tree, records cancelled
and returns the task to Assigned. Existing edits may remain; cancellation does not mean
semantic task failure. Agent deletion also cancels before existing unassignment/deletion.

## 13. Restart recovery

Normal result callbacks are gated during startup. Routing drains and durable correlated
results are accepted first. Remaining unfinished records become interrupted, tasks return
to Assigned and request messages are cleaned up; no duplicate provider launch occurs.
Tests cover graceful shutdown, real server SIGKILL/IPC disconnect and restart with an
already-durable result. A transient queued-snapshot failure also cleans the published request
without launching a provider. Corrupt snapshots fail closed without overwriting original data.

## 14. Per-agent concurrency policy

At most one unfinished execution per task and per assigned agent. Double Execute and
same-agent competing work are controlled conflicts. Three different agents execute
concurrently in integration tests. An admission/result queue protects shared transitions;
provider processes run independently once admitted. Existing interactive sessions stay separate.

## 15. Process cleanup strategy

A fixed Node IPC watchdog supervises a separate one-shot process, with no PTY or shell
interpolation. On macOS/Linux it freezes descendants, kills the dedicated group/tree and
waits for exit, including success, failure, timeout, cancellation, output overflow and
shutdown. Parent SIGKILL disconnects IPC and the surviving watchdog cleans its provider tree.
The watchdog also removes its server-owned temporary folder on IPC disconnect; the
hard-kill test asserts that cleanup. Supervision calls fixed `/bin/ps`, and a regression test rejects workspace PATH shadowing.
Tests track root/descendant PIDs and assert liveness ends. Launch failure/missing cwd and
pre-cancelled signals leave no worker. The built server ships standalone watchdog/fake bundles.

## 16. Activity integration

Execution started/completed/failed/cancelled events carry only correlation IDs, provider
and safe error code. Existing task/result queued/delivered facts remain, without message
bodies or prompts. Formatter links to Tasks; control inbox messages do not link to a
nonexistent system agent. Strict metadata tests reject prompt/body/output/env/secret fields.
The inherited unexpected-exit test now awaits the committed activity fact itself rather
than reading between provisional registry visibility and the persistence/observer event.

## 17. Frontend Task execution UI

Existing inspector chrome/tokens/board are retained. Execute is gated by actual automation
capability and launch eligibility. Working shows Running, provider, start time and Cancel;
Review shows agent, provider, summary, reported changed files and notes. Controlled errors
explain retry/sign-in needs. Bounded active polling updates real task status; Complete/Return
to Working remain human controls. Provider discovery errors offer Reload providers, preserving the selected task.
No progress percentages, token telemetry or raw logs.
Desktop and phone result drawers were inspected together; the content/file list are readable.
The inherited app-shell layout remains, without a general mobile redesign.

## 18. Fake-provider test path

Production fake adapter uses the same admission, coordinator, process supervision,
mailbox/router and result handler as Codex. It deterministically writes fake-result.txt
and returns a correlated result. It rejects symlink/hard-link output files. Edge-case
fixtures are server-injected known fake definitions running a fixed Node file; title-based
mode selection exists only in the test composition, never npm dev/start. CI needs no AI CLI,
authentication, API key or paid request. Source fake and bundled fake smoke both reach Review.

## 19. Real Codex smoke result

Local installed Codex 0.160.0: actual --version, --help and exec --help inspected. Native
login authenticated; automation options verified. A disposable Codex agent explicitly
executed “Create hello.txt containing exactly HELLO_QELVRA.” Working was observed; the
managed-workspace file contained exactly the 12 UTF-8 bytes, with no newline. The correlated
structured mailbox result referenced hello.txt and moved the task to Review. Manual Complete
was verified. A project-file SHA-256 fingerprint before/after additionally verifies no root
source files changed. All smoke data/processes are removed; existing Kite remains unchanged.

The first run reached Review but failed exact content validation. The smoke prompt was
clarified to explicitly prohibit a trailing newline and require byte verification; the
assertion was not relaxed. Subsequent verified invocation uses server-owned flags:

```text
codex --no-daemon --ask-for-approval never exec --ignore-user-config --ignore-rules
  --sandbox workspace-write --skip-git-repo-check --ephemeral --color never
  --output-schema <temporary schema.json> --output-last-message <temporary result.json> -
```

Prompt stdin and CLI structured output are used. No dangerous permission bypass or auto-login.

## 20. Unit tests

Result schema/correlation/prompt ownership: 19 tests. Atomic store: 5 tests.
Process manager launch/pre-cancellation/workspace PATH shadowing: 4 tests. Provider detector additionally tests
verified/missing/failed automation help while preserving interactive capability. Activity
privacy/formatter and configuration assertions were updated for the new strict contracts.
Execution timeout configuration rejects too-small, too-large, fractional and invalid values.

## 21. Integration tests

Coordinator fixture: 19 tests covering successful real mailbox transport/workspace edits,
manual review/completion, provider availability/auth admission, semantic/invalid/path/large/
auth/nonzero failure, timeout, cancellation, three-agent concurrency, same-agent exclusion,
strict browser fields, interactive-runtime preservation, blocked manual transitions, durable
restart result/duplicates, graceful interruption, explicit reviewer retry, snapshot-failure
request cleanup and agent deletion. Separate server SIGKILL test verifies actual process
cleanup and interrupted restart. Existing workspace test now correctly injects its no-rc
/bin/sh provider rather than using the user's configured shell through provider admission.

## 22. Browser tests

Four new real-stack flows: provider discovery failure → explicit reload → Execute recovery; fake Assign → Execute → Working → Review → manual Complete;
long-running execution → Cancel → Assigned/retryable; invalid output → controlled error/
Assigned/retryable. Result summary/provider/files/notes and disabled manual transition are
asserted. Return to Working has Execute but does not restart automatically. Full browser
suite: 73/73, one worker, zero retries. Unexpected console errors remain failures.

## 23. Repeated-run results

Final focused execution suite: 48 tests across 5 files, five consecutive passes (14.01,
13.55, 13.67, 13.50 and 16.80 seconds). Includes concurrency, full transport, invalid/large
results, timeout, cancellation, restart, persistence and process cleanup. Earlier repeats
exposed harness waits shorter than child startup under concurrent browser load. Fixture
startup now has an explicit bounded wait, the timeout test waits long enough to start a
real provider and the multi-startup integration scope has its own 10-second test budget.
No production deadline, blanket test timeout or retry policy was relaxed.

## 24. Design parity

42/42 checks pass with one worker and zero retries. The existing 14-task/five-agent fixture
now executes Scout via the real fake/test adapter, retaining one Review result and checking
its provider/summary/files/notes in the incumbent frame. Its two real task/result deliveries
are included in activity summary. No extra masks or increased pixel/layout tolerance.
UI detector reports no findings. Result content was inspected at 1440×900 and 390×844.

## 25. Full verification

587/587 unit/integration tests across 48 files pass with the normal `npm test` command.
73/73 browser checks and 42/42 design checks pass; both use one worker and zero retries.
Formatting, lint, typecheck and build pass, including standalone worker/fake bundles.
Source fake, bundled fake and authenticated Codex smoke use disposable data. Final cleanup
removes temporary API/workspace data and .qelvra-e2e; localhost remains at 5173/3001 with
Kite's original record and no test/demo agents or tasks in developer data.

## 26. Known limitations

No PR 16 intelligence, automatic review/completion, multi-step orchestration, memory growth,
verified workspace diff, raw-output log API or automation for other real providers.
Windows execution is disabled. Cwd alone is not a filesystem sandbox; Codex's native
workspace-write policy adds provider containment, with native read/auth/OS limitations.
An existing interactive runtime shares its workspace and can edit concurrently. Changed
files remain claims and cancelled/interrupted workspace edits remain. Snapshot files are not
a cross-file transaction; unrecoverable storage failure requires operator repair. Execution
history has no automatic retention policy yet. Killing the watchdog/machine itself, or hard death outside the watchdog’s active lifetime, is outside
IPC-based parent-crash cleanup guarantees. Availability cache is not model-service health.

## 27. Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
for attempt in 1 2 3 4 5; do
  npx vitest run tests/unit/execution-result.test.ts tests/unit/execution-store.test.ts tests/unit/execution-process.test.ts tests/integration/execution --maxWorkers=1 || exit 1
done
CI=1 npm run test:e2e -- --workers=1 --retries=0
CI=1 npm run test:design -- --workers=1 --retries=0
npm run execution:smoke -w @qelvra/server -- fake
npm run execution:smoke -w @qelvra/server
npm run execution:bundle-smoke -w @qelvra/server
codex --version
codex --help
codex exec --help
```

Local long runs used macOS `caffeinate -i` around the command to prevent idle sleep.
The detector command was `/Users/gugloo/.agents/skills/impeccable/scripts/impeccable detect
apps/web/src/pages/tasks/TaskInspector.tsx apps/web/src/pages/tasks/TaskExecutionDetails.tsx`.
Normal local preview remains `npm run dev`, http://127.0.0.1:5173/tasks.

## 28. Commit SHA

The immutable pushed SHA is supplied in the completion handoff. `git rev-parse HEAD`
identifies the release; excluding its SHA from its own content avoids a self-referential hash.

## 29. GitHub CI result

GitHub CI runs format/lint/typecheck/unit/integration/build and browser jobs on Ubuntu/Node
22, using deterministic fake fixtures and no real-provider credentials. The completion
handoff supplies the exact pushed SHA, GitHub run URL and final check/e2e conclusions.
Local success is not reported as remote CI success; design/native smoke remain local checks.

## 30. Suggested commit message

`feat(execution): add real AI task execution pipeline`
