# ADR 0015: explicit provider-backed task execution

Date: 2026-10-05. Status: accepted.

## Decision and ownership

Task assignment stays separate from execution. A user explicitly calls Execute; the
server admits the task, launches a one-shot provider process in its existing managed
workspace, validates the correlated result and moves the task to Review. A human must
still Complete or Return to Working. Returning to Working does not launch anything;
a previous successful execution allows another explicit Execute.

```text
TaskRegistry → AgentExecutionService → MailboxManager
  → hive/system/outbox → MessageRouter → agent inbox
  → fixed provider execution adapter → one-shot process → agent workspace
  → agent outbox → MessageRouter → hive/system/inbox
  → result validation/correlation → TaskRegistry → Review
```

`system` is a reserved control mailbox, not an AgentRegistry record. Existing agents
with that ID require manual migration before startup; creating new ones is rejected.
Normal mailbox managers and routers retain their old behavior unless the server-owned
control-mailbox option is enabled. The router remains unaware of tasks and providers.
The coordinator consumes a validated task envelope from the assigned agent's inbox.
It publishes the provider's validated response to that agent's outbox, letting the
existing router deliver it before server-controlled task mutation.

`AgentRuntimeManager` continues to own interactive PTYs. Task execution uses a
separate `ExecutionProcessManager`; it can start while an agent is stopped and never
stops an existing interactive runtime. Executing a task does not pretend the agent's
interactive lifecycle changed. The PR 11 inbox processor ignores only the reserved,
structured system task requests so it cannot consume one-shot work as generic ACK/DONE.

## API and admission

- `POST /api/tasks/:id/execute` takes `{}` or no body and returns 202.
- `POST /api/tasks/:id/cancel-execution` takes `{}` or no body and returns 200.
- `GET /api/tasks/:id/execution` returns `{ execution, result }`, both initially null.

All browser-supplied commands, executable paths, argv, cwd and extra task fields are
rejected. Admission requires an assigned task (or an explicitly returned, previously
successful task), existing assignee, available/configured provider, acceptable native
authentication and verified automation capability. Failures before admission preserve
assignment and create no execution. Manual state-changing task routes reject active or
in-admission execution. Admission, result processing and finalization share a server
queue; multiple independent agents run concurrently after admission. A task and its
agent may each own at most one unfinished execution. Agent deletion blocks admission,
cancels active work, then uses the existing task/agent deletion policy.

## Provider capability and invocation

Descriptors now distinguish `interactive` and `automation`. Only fake and Codex have
automation adapters. Codex discovery additionally checks actual `exec --help` for
all required structured-output, sandbox and context-isolation options. Missing options
or a failed automation probe disable automation while preserving verified interactive
availability. Other real providers remain interactive-only. Windows automation is
disabled until process-tree supervision is implemented and verified there.

Installed local Codex **0.160.0** was inspected using `codex --version`, `codex --help`
and `codex exec --help`. Its server-owned task invocation is:

```text
codex --no-daemon --ask-for-approval never exec
  --ignore-user-config --ignore-rules --sandbox workspace-write
  --skip-git-repo-check --ephemeral --color never
  --output-schema <server temporary schema.json>
  --output-last-message <server temporary result.json> -
```

The prompt goes through stdin. Executable, arguments and temporary output paths are
server-owned. Never-approve means the provider cannot escalate beyond its sandbox;
no dangerous bypass flag is used. Native user configuration and discovery of rules
are suppressed; explicit bounded agent instructions supply context. CLI-native login
remains available through its own HOME configuration. The original filtered replacement
environment is reused; arbitrary server secrets, API-key variables, loader/preload
variables and server configuration are not inherited. No CLI is installed or logged in.

The controlled prompt includes agent name/role, at most 8 KiB of `agent.md`, task
content, workspace rules and required result identities. `agent.md` is preserved;
`memory.md` is neither stuffed into prompts nor grown automatically. Task content never
becomes executable syntax. One-shot fake uses the identical pipeline and reads the
same structured request from stdin. Its fixed safe file writer refuses symlinks and
hard links; ordinary fake terminal/message behavior is preserved.

## Contracts, bounds and correlation

`TaskExecutionRequestSchema` is strict JSON with `kind: qelvra.task.v1`, executionId,
taskId, agentId, title, description, `workspace: .` and bounded instructions. The actual
mailbox envelope supplies requestMessageId. No absolute workspace path is included.

`ExecutionResultSchema` is strict JSON with executionId, requestMessageId, taskId,
agentId, status (`completed` or `failed`), summary, changedFiles and nullable notes.
Summary is bounded to 8 KiB, notes to 16 KiB, file count to 200 and each path to 512
characters. Total encoded JSON must fit 60 KiB. Relative POSIX paths reject absolute
paths, `.`/`..`/empty components, drive/URI colons, backslashes, controls and format
characters. Files remain **provider claims**, not verified diffs or download links.

The pure result handler validates schema, expected task, current assignee, envelope
sender/recipient, agentId, executionId and requestMessageId. Normally only an execution
awaiting a result can be accepted. Startup additionally admits a valid result for an
unfinished record after draining durable routing. Stale, spoofed, malformed and duplicate
control results are acknowledged with a safe rejection diagnostic and cannot transition
or publish completion twice. Ordinary agents cannot claim the system sender via the
outbox API. Successful AI output always stops at Review; no provider touches TaskRegistry.

Combined stdout/stderr capture is capped at 1 MiB. Invalid output, invalid UTF-8, overflow,
nonzero exit and timeout become controlled errors. Codex uses structured output rather
than prose/sentinel regexes. Its final file is read with NOFOLLOW, a regular-file/single-link
check and a 64 KiB bound. Temporary schema/result files are removed on completion.
Raw output and prompt are not persisted or exposed; sanitized authentication diagnostics
may only select a known error code.

## Persistence and recovery

`DATA_DIR/executions.json` is an atomic, versioned strict snapshot. Records contain
IDs, provider, status, request/result message IDs, timestamps, controlled error code
and validated structured result. No prompt, environment or raw process output is saved.
Corrupt/duplicate records fail startup without overwriting the source; failed writes do
not advance the in-memory store. Result records remain available after manual completion.

States are starting → queued → running → awaiting_result → succeeded, with terminal
failed/cancelled/interrupted alternatives. Task status stays Assigned → Working → Review.
Provider/process/result failure, cancellation and interruption return Working to Assigned
for explicit retry. Workspace edits are preserved and may remain after cancellation.

On startup normal result callbacks remain gated while recovery drains the router and
processes existing control results. A valid durable result is accepted first. Every other
unfinished execution becomes interrupted, its task becomes Assigned and its request is
cleaned up. No execution is automatically relaunched. This ordering also tolerates a
crash between changing the task to Review and saving the execution's completed record.
Snapshots across task/execution/mailbox files are not a database transaction; corrupt or
unwritable persistence fails closed and may require operator repair.

## Timeout and process cleanup

`EXECUTION_TIMEOUT_MS` defaults to 1,200,000 ms (20 minutes); validated configuration
allows 1,000–1,800,000 ms. The clock covers dispatch, provider work and result delivery.
Tests inject shorter deadlines. Cancellation and graceful shutdown abort and await all
active work before stopping routing, interactive runtimes, remaining PTYs and activity.

A fixed Node IPC watchdog owns each one-shot subprocess. On macOS/Linux it creates a
dedicated process group, freezes discovered descendants using the existing PTY utilities,
then kills the tree/group and verifies exit before returning. Supervision calls fixed
`/bin/ps` so workspace PATH entries cannot replace the cleanup utility. Cleanup also runs after
normal exit, output overflow and launch failure. IPC disconnect after an abrupt server
SIGKILL causes the surviving watchdog to terminate the provider tree and remove its
server-owned temporary schema/result directory. The worker exits
after reporting a bounded result/error; the parent awaits worker closure. Killing the
entire machine or watchdog is outside this guarantee. No shell interpolation is used.

Workspace cwd is server-selected. Codex additionally uses its native workspace-write
sandbox, but cwd alone is not filesystem isolation. Provider-native read permissions,
login stores, OS sandbox limitations and intentionally escaped/detached processes are
not a Qelvra security boundary. We do not claim full OS containment.

## Activity and UI

Execution started/completed/failed/cancelled events contain only execution/task/agent/
provider IDs and controlled error code. Existing task/result queued/delivered events
naturally describe the mailbox transport; neither includes message body. Control inbox
activity links back to Activity rather than a nonexistent system-agent profile.

The existing task inspector gains Execute, Cancel, real running state/provider/start
time and validated summary/reported files/notes. It polls execution status while active,
updates the task and preserves Complete/Return to Working. Interactive-only, unavailable
or unauthenticated providers disable Execute with an honest reason. No fake percentages,
context usage or token counts are added. Existing design chrome, tokens, board and frames
remain. CI uses deterministic fixed provider fixtures through the production coordinator.

No orchestrator intelligence, autonomous management, automatic completion, memory growth,
workspace diff viewer, raw-output log API or PR 16 feature is included.
