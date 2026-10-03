# PR 10 verification: automatic message delivery

Verified locally on 2026-10-04. Scope is filesystem delivery only. Architecture and
failure semantics are detailed in [ADR 0010](../adr/0010-message-router.md).

## Files created

- `apps/server/src/lib/atomic-publish.ts`
- `apps/server/src/mailbox/message-integrity.ts`
- `apps/server/src/router/index.ts`
- `apps/server/src/router/message-router.ts`
- `apps/server/scripts/router-smoke.ts`
- `tests/fixtures/server-with-router.ts`
- `tests/unit/message-router.test.ts`
- `tests/integration/server/message-router.test.ts`
- `tests/integration/server/message-router-shutdown.test.ts`
- `docs/adr/0010-message-router.md`
- `docs/verification/pr10-message-router.md`

## Files modified

- `README.md`
- `apps/server/package.json`
- `package-lock.json`
- `apps/server/src/app.ts`
- `apps/server/src/mailbox/errors.ts`
- `apps/server/src/mailbox/mailbox-manager.ts`
- `apps/server/src/workspaces/agent-workspace-manager.ts`
- `docs/architecture/overview.md`
- `tests/integration/server/agent-mailboxes.test.ts`
- `tests/unit/mailbox-manager.test.ts`

## API and behavior

`MessageRouter` exposes internal `start()`, `stop()`, `isRunning()`, `rescan()` and
`status()` methods. `processEntry(agentId, filename)` is a constrained watcher/test
hook. No router HTTP controls or arbitrary filesystem paths are exposed.

Chokidar 4 watches only the bounded agents/outbox tree, ignoring hidden, temporary,
non-JSON files, inboxes and workspaces. Registry creation refreshes validated outboxes;
deleted senders are rejected while their existing data remains preserved. Startup
waits for watcher readiness and scans offline backlog in createdAt/ID order per sender.
Live events are buffered during startup scan; live ordering afterward is unspecified.

Delivery validates the source through MailboxManager, verifies ownership and current
registrations, publishes the unchanged six-field envelope exclusively into the inbox,
syncs its file/directory, and only then acknowledges the matching source snapshot.
Outbox and inbox share one atomic publication helper. Existing exact destinations are
synced and accepted for crash recovery; conflicting or invalid destinations are never
overwritten. Duplicate events share an in-flight promise. Four deliveries can execute
concurrently, with source keys released in finally.

Transient failures have three total attempts with 100/300 ms delays, then remain
pending until rescan/restart. Permanent failures use generated
`hive/quarantine/<sender>/<uuid>/message.json` and `error.json`. Metadata contains a
sanitized original filename and controlled error code, never the body. Unsafe entries
or quarantine failures remain pending. Body-free internal events support later Activity
integration without an event database.

The router imports no runtime or PTY manager. Stopped recipients receive messages.
Fastify starts it before serving, fails startup on initialization errors, closes on
fatal watcher errors, and awaits router stop before runtime/PTY cleanup. Real SIGINT
and SIGTERM shutdown are covered. No PTY notification, provider behavior, orchestration,
task execution or messaging UI is included.

## Results

| Verification                   | Result                                                |
| ------------------------------ | ----------------------------------------------------- |
| Format, lint, typecheck, build | Passed                                                |
| Full Vitest suite              | 407/407 tests, 29 files                               |
| Focused router/mailbox suite   | 64/64, five consecutive final passes (320 executions) |
| Existing browser E2E           | 62/62, one worker, no retries                         |
| Existing design parity         | 42/42, unchanged design/masks/thresholds              |
| Disposable manual smoke        | Passed                                                |

Focused tests cover 14 router policy cases, 23 router integration cases, two real
signal shutdown cases and 25 mailbox cases. Integration coverage includes live/stopped
delivery, ordered backlog, duplicate events, exact-destination recovery, failed
acknowledgement recovery, spoofing, malformed/oversized messages, deleted recipients
and senders, newly created/recreated agents, destination conflicts, bounded retries,
unsafe quarantine paths, startup cancellation/failure and stop/restart recovery.

The concurrency case routes 50 Nova messages plus three messages from other senders:
all 53 reach the correct inboxes with unique IDs, drained outboxes and no publication
temporary files. Only this bulk case has a 15-second timeout. An earlier repeated run
exposed a startup event ordering race; startup buffering and a deterministic regression
test fixed it. The final five runs passed in 6.38, 5.90, 4.57, 4.37 and 4.19 seconds.

The smoke script uses its own disposable DATA_DIR, creates Nova/Atlas, sends
HELLO_ATLAS without explicit delivery/rescan, starts/stops Atlas and proves stopped
delivery, restarts the router with offline backlog, and quarantines malformed JSON.
Fixtures close watchers/servers and remove their own data in cleanup. Signal tests
verify a fully delivered or recoverable pending envelope and clean process exit.
Production Kite data is preserved; localhost is restored on ports 3001/5173.

## Exact commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run router:smoke -w @qelvra/server
```

Run the following focused command five consecutive times:

```sh
npx vitest run tests/unit/message-router.test.ts tests/unit/mailbox-manager.test.ts tests/integration/server/message-router.test.ts tests/integration/server/message-router-shutdown.test.ts
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
git diff --check
```

The local browser cache was missing the required Chromium version. Installing it with
`npx playwright install chromium` resolved that environment issue; no application or
test expectations were changed for it.

## Limits and handoff

At-least-once recovery is idempotent while the matching inbox file exists. There is no
consumed-ID ledger, strict live ordering, cross-process lock, persistent retry scheduler,
mailbox count quota or cross-host delivery. Atomic publication requires hard links and
POSIX directory sync. Same-user path/content races and hard-link aliases remain within
PR 8/9's trust model; this is not an OS sandbox or forensic immutable archive. A failed
quarantine can leave inspection copies alongside the pending source. Manually authored
messages must be atomically published; the router does not detect incomplete editor
writes. See ADR 0010 for the complete durability and lifecycle boundaries.

Commit message: `feat(router): add automatic agent message delivery`.
The final handoff supplies the resulting commit SHA and GitHub CI URL/status.
PR 11 is deferred.
