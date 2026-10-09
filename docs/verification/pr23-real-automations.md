# PR 23 — Real Automations verification

Baseline: `main` at `beb121d167452df463c7394d85d859739c0d46b1`.
Branch: `codex/pr23-real-automations`. Date: 2026-10-09.
Specification: [source audit](../plans/pr23-real-automations.md) and the user's
explicit scheduled-agent-tasks-only implementation requirements.
Semantics and recovery: [ADR 0023](../adr/0023-real-automations.md).

## Implemented result

`/automations` replaces the placeholder with persistent task templates, registered
agent assignment, native UTC one-time/fixed-interval forms, enable/disable,
Run now, actual next due/last outcome, bounded run history, generated task links
and explicit interrupted-run acknowledgement. Saved templates start disabled.
Failures include plain-language recovery instructions and controlled diagnostics.

Every admitted run reserves new run/task identities before dispatch through the
existing task/execution services. Successful work stays in Review. A single global
automation admission, 5-minute–30-day intervals and skipped missed/busy slots
prevent catch-up bursts. One snapshot retains up to 100 templates/500 run records;
history responses show at most 50 with retention/recorded totals.

All servers now claim DATA_DIR exclusively before startup validation or recovery.
A second live server or unreleased crash claim fails closed. Clean shutdown
releases ownership only after domain cleanup; hard-crash recovery requires a
verified stopped-server intervention. There is no exactly-once paid execution claim.
Automation events contain allowlisted metadata only; persisted task origin also
keeps automation template titles out of existing task Activity events.

## Acceptance evidence

| Requirement                                | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UTC and deterministic scheduling           | Injected clock covers exact due/grace boundaries, anchored intervals, leap-day calculation, forward/missed skips, backwards clock and latest-run ordering, one-time expiry and disable.                                                                                                                                                                                      |
| Durable admission and duplicate prevention | Reservation write precedes task creation; failed write dispatches nothing; concurrent Run now with the same revision returns the same run/task; completed tasks are never recycled.                                                                                                                                                                                          |
| Overlap and provider safety                | One global automation slot; overlapping schedules/existing manual executions skip; deleted agents disable; real shell/unavailable/auth checks, Fake failure and real supervised timeout preserve retryable task state.                                                                                                                                                       |
| Recovery and ownership                     | Reserved work without a task interrupts; durable success restores Review; graceful shutdown blocks admissions; real child-server SIGKILL stops provider descendants and retains the ownership claim; verified dead-process intervention allows interrupted recovery without relaunch. Second-process/canonical-path/token replacement/corrupt startup protection are tested. |
| Review and restart persistence             | Fake execution writes a real workspace file; task stays Review until explicit human completion; restart retains template, history and completed task; subsequent run creates a different task.                                                                                                                                                                               |
| API and privacy                            | Strict IDs/body/query/revision/UTC/interval validation; bounded no-store history/list; unsupported scripts/goals/cron rejected; filtered Automation Activity and on-disk events exclude private template titles, instructions and output.                                                                                                                                    |
| Browser                                    | Real CRUD/edit/enable/disable, next due, Run now/Review/task link, reload persistence, real one-time dispatch, mobile keyboard use/no overflow, error retry/stale-state blocking, past-time validation and controlled interruption acknowledgement.                                                                                                                          |
| Design                                     | Desktop 1440px/mobile 390px detail and native form captures with a real failed Fake run. Header clearance, one main landmark, primary token and horizontal overflow asserted. Fresh finish review's recovery-copy fix resolved; final disposition ship. Documentation audit preserves incumbent system.                                                                      |

## Verification results

All storage/process fixtures are disposable. No paid Codex execution is required.

| Check                                       | Result                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| Focused scheduler/API/ownership/crash suite | 38 tests / 4 files passed in five consecutive final runs |
| Format, lint, typecheck                     | Passed                                                   |
| Complete unit/integration suite             | 790 tests / 74 files passed                              |
| Build                                       | Passed                                                   |
| Complete browser suite                      | 117 tests passed                                         |
| Complete design suite                       | 45 tests passed                                          |
| Release browser suite                       | 2 tests passed                                           |
| Production smoke                            | Passed built production distribution checks              |
| Release smoke                               | Passed 5 lifecycle/restart cycles (32 seconds)           |

Local logs are in `/tmp/qelvra-pr23-verification/` (not committed). Captures under
`.impeccable/review/automations/` are local ignored verification evidence, not
shipping imagery. The mechanical detector ran once on the main page with no
findings. Fresh finish review and [surface documentation audit](../design/pr23-automations.md)
are complete; pre-existing design reference drift is disclosed and unchanged.

The first complete unit run identified pre-existing fixture assumptions: Activity
canonical counts/fixtures needed the new event family, and app/production/crash
fixtures needed exclusive-storage cleanup before reopening. Those fixtures now
follow the real shutdown/verified-crash recovery policy. The older Automations
navigation test also now expects the implemented page instead of its placeholder. Final verification does
not bypass the ownership guard or relax its fail-closed behavior. The Automations
design fixture owns separate disposable storage so retained generated-task Activity
cannot contaminate the shared Home parity fixture.

## Protected state and limits

Actual user data hashes remain unchanged:

- Agent registry: `1b23983b5b59482d45b217d27b0eb9c5e73f7c527cdc167e672c2f8b0fa1991e`.
- Kite memory: `0e4d0b69a534cd9fe193cbc3810423ed4aac9b2dfd2ca6a23a9241200f526fab`.
- Tasks: `65794c4d7eadd54a8151c2eb2b7c8727fb62d05e8c453ff8d1a3c6427dedc935`.
- Goals: `83650f416eb11d0894eadc8f8a88c5c48ceb1c043385052495d009f0f09f4ab2`.
- Executions: `30c1ae27ada59c7502f5770485e272c06388b3db24cd4ebff489cb79db0f8a47`.

Local/remote beta tag object remains
`7bd5c0f09c15e2fca54c0dec1528c3fe6d9302e1`; no release tag was modified.
No new dependencies, credentials UI, generic shell/script execution, scheduled
goals, cron, event triggers, integrations or PR 24 work were introduced.

Scheduling only runs on a local active server and skips missed work. Crash claims
require explicit operator intervention; existing external provider execution and
workspace edits cannot be transactionally rolled back. Global run-history limits
may omit older records, while preserving each template's newest outcome and active
reservation. Review is a recorded execution outcome, not automatic human completion.

## Delivery

Implementation PR targets `main`. Exact head commit and hosted CI results are
reported in the PR and final delivery message after local verification; this file
does not claim hosted success before the exact-head run completes.
