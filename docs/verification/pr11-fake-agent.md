# PR 11: Fake-agent verification and demo

Verified locally on 2026-10-04. This milestone adds a deterministic development CLI
through real agent runtimes and PTYs. No AI API, orchestrator, task execution or
messaging UI is included. See [ADR 0011](../adr/0011-fake-agent.md).

## Created files

- `apps/server/src/agents/runtime-command.ts`
- `apps/server/src/fake-agent/cli.ts`
- `apps/server/src/fake-agent/behavior.ts`
- `apps/server/scripts/fake-agent-smoke.ts`
- `tests/unit/fake-agent.test.ts`
- `tests/integration/server/fake-agent.test.ts`
- `tests/integration/server/fake-agent-shutdown.test.ts`
- `tests/fixtures/server-with-fake-agents.ts`
- `docs/adr/0011-fake-agent.md`
- `docs/verification/pr11-fake-agent.md`

## Modified files

- `README.md`
- `apps/server/package.json`
- `apps/server/scripts/build.mjs`
- `apps/server/src/agents/agent-registry.ts`
- `apps/server/src/agents/agent-runtime-manager.ts`
- `apps/server/src/agents/errors.ts`
- `apps/server/src/app.ts`
- `apps/server/src/mailbox/mailbox-manager.ts`
- `apps/server/src/pty/pty-manager.ts`
- `apps/server/src/pty/types.ts`
- `apps/server/src/routes/agents.ts`
- `packages/shared/src/agent.ts`
- `packages/shared/src/api.ts`
- `tests/integration/server/agents-api.test.ts`
- `tests/e2e/agent-terminal.spec.ts`
- `docs/architecture/overview.md`

## Commands, integration and persistence

Commands: PING, ECHO, STATUS, SEND, SEND_TASK, CHECK_INBOX, RESPOND and AUTO_RESPOND
ON/OFF. PING prints PONG; STATUS prints READY with identity. SEND publishes a message;
SEND_TASK publishes a task. Responses are `result` envelopes containing ACK or DONE
prefixes. Result/status/error envelopes never trigger replies and stay readable.

The existing create API persists the fixed optional provider ID `fake`. Development
and test enable it; production rejects it. Null/default keeps the local shell. Runtime
selects the fixed Node executable/CLI and server-owned ID/data configuration. Browser
payloads cannot set commands, args, env, cwd or runtime status. No provider management
UI or registry is introduced. Source uses the installed tsx loader; build provides a
plain Node child bundle beside the built server.

The CLI validates its own workspace, reads fresh registry snapshots without modifying
them, and reuses MailboxManager/shared contracts. It reads only its own inbox and
writes only its own outbox; the unchanged router does all routing. Outbox publication
now includes directory fsync. Incoming acknowledgement occurs after response publication,
with response identity retained in memory across acknowledgement failures.

AUTO_RESPOND starts on, scans backlog immediately, then checks every 500 ms without
overlapping scans. Mode is process-local. Stop closes polling/readline and lets active
work settle; runtime owns PTY/process-tree cleanup. Unexpected SIGKILL updates runtime
state to error, leaves mailbox data intact, and restart scans pending data. Results
never cause ping-pong, including when both endpoints use AUTO_RESPOND.

## Test results

| Check                       | Result                                                |
| --------------------------- | ----------------------------------------------------- |
| Focused fake suite          | 19/19, five consecutive final runs, 95 executions     |
| Focused durations           | 8.81, 9.57, 12.87, 8.90, 10.80 seconds                |
| Full unit/integration suite | 427/427 tests across 32 files                         |
| Browser E2E                 | 63/63, one worker, zero retries                       |
| Design parity               | 42/42, existing references/masks/thresholds unchanged |
| Disposable manual smoke     | Passed                                                |
| Built Node CLI sanity check | PONG and clean SIGTERM exit without a TS loader       |

Eight unit cases cover deterministic message/task behavior, opaque body preservation,
three nonresponding types, same-process acknowledgement recovery, failed publication
ordering, and fixed provider/stripped executable configuration. Nine integration
cases use real AgentRuntimeManager/PtyManager and real router: Nova–Atlas round-trip,
three agents, stopped recipient, restart, crash, five-agent concurrency, invalid
commands/recipients, failed response publication and production gating. Two additional
real server signal cases cover SIGINT/SIGTERM and verify every fake PID exits with
pending inbox data preserved.

The concurrency test sends 25 requests through five actual PTYs and receives 25 unique
results from the correct agents, totaling 50 router deliveries. Outboxes drain;
result IDs are unique; explicit RESPOND does not create another reply. Successful
cases assert no unexpected quarantine or temporary publication files. Each fixture
owns disposable DATA_DIR and verifies zero runtime/PTY sessions and dead owned PIDs
before deleting data.

The browser test creates two fake agents through REST, deliberately includes ignored
executable/env fields, starts real processes, types PING and SEND into xterm, switches
to Atlas, returns to Nova and reads ACK:HELLO_FROM_BROWSER using CHECK_INBOX. No direct
mailbox endpoint/filesystem delivery bypass is used.

During verification, separate asynchronous inbox reads caused a test predicate to accept
an empty second snapshot. Predicates now inspect one snapshot. Earlier runs overlapped
browser/process workloads and hit restart deadlines and one concurrency wait. Multiple-process round-trip, three-agent, stopped-recipient, restart
and crash cases have explicit 15-second deadlines for real process launches;
the bulk five-agent case retains its 20-second deadline. No production retry policy,
polling interval, global timeout or assertions were weakened. Failure diagnostics
retain only disposable fixture output. The final five consecutive runs all passed.

## Disposable demo

```sh
npm run fake:smoke -w @qelvra/server
```

This creates Nova/Atlas inside an automatically removed temporary directory, starts
actual runtime PTYs, sends PING and HELLO_ATLAS, prints the ACK, stops Atlas, sends
STOPPED_ATLAS, verifies persisted inbox data, restarts Atlas and prints its returning
ACK. It also checks drained sources, no loops, no quarantine and no temporary files.
Existing local agents and workspaces are untouched.

## Browser manual demo

With `npm run dev` running in development mode, provision two explicitly named demo
agents through the fixed API. If either ID already exists, choose another pair rather
than overwrite/delete user data.

```sh
curl -fsS http://127.0.0.1:3001/api/agents -H 'Content-Type: application/json' -d '{"id":"demo-nova","name":"Demo Nova","role":"Demo / Test","providerId":"fake"}'
curl -fsS http://127.0.0.1:3001/api/agents -H 'Content-Type: application/json' -d '{"id":"demo-atlas","name":"Demo Atlas","role":"Demo / Test","providerId":"fake"}'
curl -fsS -X POST http://127.0.0.1:3001/api/agents/demo-nova/start
curl -fsS -X POST http://127.0.0.1:3001/api/agents/demo-atlas/start
```

Open `http://127.0.0.1:5173/terminal?agent=demo-nova`. Type:

```text
PING
SEND demo-atlas HELLO_ATLAS
CHECK_INBOX
```

Expected: PONG, MESSAGE_QUEUED and then result ACK:HELLO_ATLAS. Delivery/auto response
is asynchronous; repeat CHECK_INBOX if the first check precedes arrival. To demonstrate
offline delivery, select Demo Atlas's terminal tab and stop it, return to Demo Nova
and send `SEND demo-atlas STOPPED_ATLAS`, then start Demo Atlas again and inspect Demo
Nova's inbox. The response is ACK:STOPPED_ATLAS. CHECK_INBOX does not consume results.
Stop the demo agents using their normal controls when finished.

## Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run fake:smoke -w @qelvra/server
```

Run this focused command five consecutive times:

```sh
npx vitest run tests/unit/fake-agent.test.ts tests/integration/server/fake-agent.test.ts tests/integration/server/fake-agent-shutdown.test.ts
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
git diff --check
```

## Limits and final handoff

Same-user filesystem access remains the existing trust boundary. CLI commands never
execute bodies, but no OS sandbox is claimed. Processing is at-least-once: crash after
response publication and before acknowledgement can produce another response after
restart, since no durable consumed-ID ledger exists. Malformed inbox entries remain
for repair; oversized ACK/DONE responses leave their incoming envelope intact. Results
remain until a future consumer acknowledges them. Registry snapshots can become stale;
the router validates current recipients. Polling/snapshot reads suit a development
demo rather than high-volume operation. Windows runtime and directory-fsync support
remain best-effort under existing platform limits.

Commit message: `feat(agents): add deterministic fake-agent execution loop`.
The final response supplies the resulting commit SHA and GitHub CI result.
PR 12 is deferred.
