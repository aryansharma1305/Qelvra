# PR 22 — Real Agent Network verification

Baseline: `main` at `0cf2ff5d98a2f2f6c4f3496a610308a6dffc61e4`.
Branch: `codex/pr22-real-agent-network`. Date: 2026-10-09.
Primary specification: [committed source audit and plan](../plans/pr22-real-agent-network.md).
Implementation semantics: [ADR 0022](../adr/0022-real-agent-network.md).

## Implemented result

`/network` is a read-only inspection surface over registered agents, current PTY
metadata, retained router message observations, persisted materialized goal
membership and task assignments. It replaces the entire sample graph, telemetry
panel and IPC timeline. Both the preview notice and sidebar Preview badge are
removed only for Network. Other preview pages remain deferred.

GET `/api/network` uses strict shared query/response schemas with allowlisted
projection fields. The existing Activity transport invalidates snapshots;
visible-page fallback, cancellation, coalescing, disconnect and stale recovery
are explicit. Native node selection links to the real agent route. Desktop has a
deterministic graph/list choice; mobile has an equivalent bounded list and textual
relationship evidence. There are no domain mutation controls.

## Acceptance evidence

| Requirement                     | Evidence                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real nodes only                 | Registry supplies all identities/names/roles; empty/single/isolated cases in projection tests; browser creates a real disposable agent and navigates to its detail. No hardcoded sample agent records remain in Network components.                                                                                   |
| Current status/provider/runtime | Explicit registry and PTY fields; running/stopped runtime fixtures; PTY presence is separate from AI execution/authentication. No provider discovery calls in projection.                                                                                                                                             |
| UTC presets and strict query    | Default 24h; 1h/24h/7d start-inclusive/end-exclusive unit cases; HTTP rejects unknown, invalid, repeated and array parameters.                                                                                                                                                                                        |
| Directed message evidence       | Both directions, self-observations, all four lifecycle types, event-ID deduplication, per-message/pair/type deduplication and missing message-ID semantics tested.                                                                                                                                                    |
| Accurate participation          | Persisted materialized orchestrator/worker slots, multiple goals, draft annotation and no worker clique tested. Message and participation styles are distinct.                                                                                                                                                        |
| Assignments, not task edges     | Current single assignee annotates nodes; old active and recent terminal task/goal eligibility tested.                                                                                                                                                                                                                 |
| Deleted/reused participants     | Missing/system/deleted IDs omitted; pre-registration message/task/goal evidence excluded conservatively; no ghost nodes or dangling endpoints.                                                                                                                                                                        |
| Bounded projection              | 10,000-event fixture; 100 nodes, 200 edges, 20 tasks/goals per node, 20 references per participation edge, 50 timeline observations. Eligible vs displayed totals and stable order tested.                                                                                                                            |
| Source limitations              | Retention, oldest-history interval, journal cap, integrity and even one recording failure tested and visibly disclosed.                                                                                                                                                                                               |
| Read-only and privacy           | Disposable-source bytes/mtime unchanged across repeated reads; spies confirm no mailbox read/write/acknowledge, provider discovery/refresh, runtime start/stop, task assignment, goal run or Activity publication. Sentinel descriptions, memory/workspace/message content and runtime PID/session data are excluded. |
| Restart persistence             | Dedicated API restart test restores registry/task/goal/message evidence; current PTYs remain absent after restart. Existing release restart flow also passes.                                                                                                                                                         |
| Loading/recovery                | Initial failure/Retry, failed refresh retaining the loaded interval, cancelled obsolete window response and disconnected notification messaging tested.                                                                                                                                                               |
| Lifecycle cleanup               | Real Activity frame bursts trigger bounded refetches; in-flight invalidation coalesces; synthetic visibility transitions stop fallback/subscriptions and reload on return; unmount stops further requests.                                                                                                            |
| Keyboard/mobile                 | Native selection via Enter, pressed state, real links and equivalent evidence list tested at 390px; document overflow is checked.                                                                                                                                                                                     |
| Graph rendering                 | Design checks assert real edge count and visible nonblack SVG strokes; no SVG traffic animation. Final desktop/mobile captures inspected.                                                                                                                                                                             |
| Design scope                    | Network's three static Stitch cases are replaced by one deterministic real-data desktop/mobile check. Other route parity cases and mismatch budgets are unchanged.                                                                                                                                                    |

## Local verification

All commands use Node `v22.23.2` and disposable test storage, never actual user
workspaces or memory.

| Command                                                                                                                            | Result                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Focused Vitest: `tests/unit/network.test.ts`, `tests/unit/web-network-api.test.ts`, `tests/integration/server/network-api.test.ts` | 33 tests / 3 files passed in **five consecutive final runs**                                      |
| Focused Network browser suite                                                                                                      | 9 passed, zero retries                                                                            |
| `npm run format:check`                                                                                                             | Passed                                                                                            |
| `npm run lint`                                                                                                                     | Passed                                                                                            |
| `npm run typecheck`                                                                                                                | Passed                                                                                            |
| `npm test`                                                                                                                         | 753 tests / 71 files passed                                                                       |
| `npm run build`                                                                                                                    | Passed                                                                                            |
| `CI=1 npm run test:e2e -- --workers=1 --retries=0`                                                                                 | 110 passed, zero retries                                                                          |
| `npm run test:design`                                                                                                              | 44 passed, including desktop/mobile real Network coverage                                         |
| `npm run test:release -- --workers=1 --retries=0`                                                                                  | 2 passed, zero retries                                                                            |
| `npm run production:smoke`                                                                                                         | PASS, including production Fake rejection, origins/headers, built assets and distribution notices |
| `npm run release:smoke`                                                                                                            | PASS, 5 cycles; no PTYs/executions left running, final resource list only CloseReq                |

The first design pass caught a test measuring the heading after mobile node
selection had scrolled the document. The first screenshot also exposed unresolved
SVG color variables and the remaining sidebar Preview badge. SVG now uses the
incumbent Tailwind color classes, the badge is removed, and captures reset to the
document top. These corrections are included in the final confirmation, rather
than masked or accepted as a mismatch budget increase.

Captures (local, ignored review evidence):
`.impeccable/review/network/desktop.png` at 1440px and
`.impeccable/review/network/mobile.png` at 390px. The mechanical Impeccable detector
ran once after completion with an empty findings list. The independent finish
review and incumbent-system documentation review both returned **SHIP**, with no
material fixes. The final desktop/mobile inspection found readable controls and
visible typed relationships without document overflow. Existing design-system
prose drift was left unchanged; this extension required no new design direction.

## Protected data and release state

No user data or beta tag was modified. Actual registry SHA-256 remains
`1b23983b5b59482d45b217d27b0eb9c5e73f7c527cdc167e672c2f8b0fa1991e`.
Kite memory remains
`0e4d0b69a534cd9fe193cbc3810423ed4aac9b2dfd2ca6a23a9241200f526fab`.
The local and remote annotated `v0.1.0-beta.1` tag object remains
`7bd5c0f09c15e2fca54c0dec1528c3fe6d9302e1`.

## Limits and delivery boundary

History is retained recorded evidence, not mailbox inventory or guaranteed
lifetime traffic. Participation is persisted assignment metadata, not proof of
message exchange. Node/edge/detail/timeline caps deliberately omit excess data
with visible totals and flags. Registration guards may omit legitimate workers
registered after a goal's creation. Graph placement is deterministic, not a
physics/layout system. Snapshot copies do not form a domain transaction.

There is no new persistence, provider probing, message behavior, graph editing,
agent control, telemetry store, Automations or Shared Projects implementation.
PR 23 and PR 24+ remain deferred.

The implementation PR targets `main`. Completion additionally requires hosted
`check` and `e2e` success at the submitted PR's exact head. The final delivery
reports the immutable commit SHA, PR URL and CI run URL/results separately from
this pre-submission local verification record.

## Pre-merge review correction

The independent standards and specification reviews both found the same refresh
starvation defect: sustained Activity frames repeatedly reset the trailing timer,
including fallback ticks. A new browser regression failed against the original
hook. Notifications now share one bounded 150 ms pending timer, and the 10-second
fallback calls the already coalesced loader independently. Hidden/unmount cleanup
clears the pending timer reference. The corrected Network browser suite passed
**10 tests with zero retries**; the sustained-frame regression was also rerun
against the original hook and failed as expected. Timer-based tests install their
clock before navigation and separately verify the visible fallback, hidden pause,
unmount cleanup and in-flight coalescing. Formatting, lint, typecheck and build
passed after the correction. Hosted CI must pass on the corrected exact head
before merge. No other material review finding remained.
