# PR 9 mailbox verification

## Files created

- `packages/shared/src/message.ts`
- `apps/server/src/mailbox/{mailbox-manager,types,errors,index}.ts`
- `apps/server/scripts/mailbox-smoke.ts`
- `tests/unit/message-schema.test.ts`
- `tests/unit/mailbox-manager.test.ts`
- `tests/integration/server/agent-mailboxes.test.ts`
- `docs/adr/0009-mailbox-layer.md`
- This verification record.

## Files modified

- `packages/shared/src/index.ts`: exports canonical messages.
- `packages/shared/tsconfig.json`: includes DOM type declarations for portable TextEncoder.
- `apps/server/src/workspaces/agent-workspace-manager.ts`: fixed safe mailbox accessor.
- `apps/server/src/app.ts`: composes `app.mailbox`, without public routes.
- `apps/server/package.json`: disposable smoke command.
- `docs/architecture/overview.md` and `README.md`: mailbox architecture and milestone.
- `playwright.design.config.ts`: serial reference/app capture, same pixel checks.

## Schema, API and identity

Strict V1 schema: `{ id, from, to, type, body, createdAt }`. Types are task, message,
result, status and error. IDs are `msg-<lowercase UUID v4>`, generated server-side by
`crypto.randomUUID`. Sender/recipient use shared AgentIdSchema. Body is nonempty,
null-free opaque text capped at 65,536 UTF-8 bytes. Timestamp is validated UTC ISO.
No reply threads or metadata blobs.

The four methods are `writeOutboxMessage(agentId, { to, type, body })`,
`readMessage(agentId, box, messageId)`, `listMessages(agentId, box)` and
`acknowledgeMessage(agentId, box, messageId)`; box is inbox or outbox only. Creation
sets sender from owner context and rejects caller-supplied envelope fields. Recipient
must exist in the registry, even if an old filesystem workspace still exists. Runtime
state is irrelevant. Reads require envelope/filename agreement and mailbox ownership.

## Atomicity, listing and acknowledgement

Exclusive 0600 same-directory temp creation → complete JSON write → file fsync → close
→ exclusive atomic hard-link publication → temp unlink. A portable Node rename would
overwrite collisions, so it is deliberately replaced with no-overwrite publication.
Three collision attempts are allowed. There is no unsafe overwrite fallback.

Listing validates each final JSON file, sorts by timestamp then message ID, and returns
valid messages plus invalid filename/reason metadata. Temp files are ignored. Non-JSON,
malformed JSON/UTF-8, invalid schema/ownership, unsafe entries and oversized files are
reported separately. Stat and bounded reads cap file ingestion at 394,240 bytes.

Acknowledgement explicitly validates then unlinks one message in either box; no archive
is added. Repeated removal returns false. Per-message acknowledgement queues ensure
one successful removal within a manager. Invalid files are left untouched.

Concurrent writes need no global queue: UUIDs and exclusive publication prevent
collisions/overwrites. Fifty simultaneous writes are tested for unique IDs, complete
validated content, sorted listing and no temp remainders. Sending never delivers.

## Unit and integration coverage

- Shared schema: 20 cases (all five types, invalid envelope/body/IDs/time, UTF-8 boundary).
- Mailbox manager: 22 cases covering writes, server-controlled sender, recipient lookup,
  safe paths, read/list/acknowledgement, deterministic order, malformed/manual files,
  symlinks/directories, worst-case escaped bodies, growing oversized files, invalid UTF-8,
  collision retries/symlink collisions, controlled I/O errors, workspace preservation,
  atomic visibility, write/fsync/publication failure cleanup and concurrency.
- Server integration: 2 cases covering app composition, outbox-only persistence across
  restart, no PTYs/runtime, no external messaging routes and deleted-recipient rejection.

The atomicity test pauses after deliberately writing a partial temporary file, checks
there is no final file and listing is empty, then resumes and reads complete final JSON.
Failure tests inject write, fsync and publication errors and assert controlled errors
with no corrupt final file or temporary remainder. Tests own disposable DATA_DIRs and
remove them after each case. No mailbox test launches a PTY.

## Results

- Focused mailbox suite: 44/44, five consecutive final runs (220 case executions passed).
  An earlier repeated run caught concurrent acknowledgement reporting multiple successes;
  per-message serialization fixed it before the five final passes.
- Full Vitest: 365/365 across 26 files.
- Format, lint, typecheck and production build: passed.
- Full E2E: 62/62, CI mode, one worker, zero retries.
- Design parity: **42/42** in the final serial run (3.0 minutes). The first three-worker
  run was 39/42, with scattered text-edge differences on terminal, agents and onboarding
  goal; geometry passed. Serial capture eliminated the observed differences. No UI,
  masks, thresholds or approved exports changed.
- Manual smoke: passed. Nova and Atlas created in temporary DATA_DIR; HELLO_ATLAS written
  only to Nova outbox, validated read matched from/to/body, Atlas inbox empty, explicit
  removal left outbox empty. Temporary DATA_DIR removed in finally; no runtime imported.

## Limits

See ADR 0009 for same-user filesystem races, unsigned manual files, allowed read-only
hard links, lack of cross-process acknowledgement locks, nontransactional listings,
creation-time recipient lookup, no count quotas and no directory fsync/power-loss
promise. Crash leftovers are ignored; there is no automatic stale-temp cleanup. Link
publication requires filesystem hard-link support. No routing, watcher, delivery,
orchestrator, provider behavior or live UI messaging is part of this milestone.

## Exact commands

```sh
for run in 1 2 3 4 5; do
  npx vitest run tests/unit/message-schema.test.ts tests/unit/mailbox-manager.test.ts tests/integration/server/agent-mailboxes.test.ts || exit 1
done
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
npm run mailbox:smoke -w @qelvra/server
git diff --check
```

Suggested commit: `feat(mailbox): add atomic agent mailbox layer`.
PR 10 remains unimplemented.
