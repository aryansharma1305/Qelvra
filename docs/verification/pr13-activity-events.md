# PR 13 verification: persistent realtime activity

PR 13 adds the canonical event system, real Activity page and live Dashboard feed/counts.
No PR 14 work, real AI providers, orchestrator intelligence or advanced analytics is included.

## 1. Files created

- `packages/shared/src/activity-event.ts`
- `apps/server/src/activity/{activity-store,activity-publisher,activity-errors,activity-routes,activity-gateway,domain-events,index}.ts`
- `apps/server/scripts/activity-smoke.ts`
- `apps/web/src/features/activity/{activity-client,use-activity,format-activity}.ts`
- `apps/web/src/pages/activity/ActivityPage.tsx`
- `tests/unit/{activity-schema,activity-store,web-activity}.test.ts`
- `tests/integration/activity/activity.test.ts`
- `tests/e2e/activity.spec.ts`
- `tests/design/activity-parity.ts`
- `docs/adr/0013-activity-events.md`, this report

## 2. Files modified

- `apps/server/package.json`, `src/app.ts`, `src/agents/agent-runtime-manager.ts`, `src/router/message-router.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/{app/router.tsx,lib/api.ts}`
- `apps/web/src/pages/home/{ActiveOperatives,ActivityItem,HomeHero,HomePage,SwarmTelemetry,TeamActivity}.tsx`
- `tests/{design/parity.spec.ts,e2e/navigation.spec.ts,unit/mocks.test.ts}`
- `README.md`, `docs/architecture/{overview,frontend}.md`
- Deleted `apps/web/src/mocks/activity.tsx`; no production activity mock remains.

## 3. Event schema

Strict Zod discriminated metadata per domain, `evt-UUIDv4`, server ISO timestamp,
optional actor, typed entity. Both REST records and WebSocket frames are validated.
Event IDs/times cannot be supplied by browsers. Unknown payload/metadata fields fail
validation instead of being silently retained. Agent names/task titles are bounded.

## 4. Canonical event types

- agent.created, agent.started, agent.stopped, agent.restarted, agent.deleted, agent.error
- message.queued, message.delivered, message.quarantined, message.delivery_failed
- task.created, task.assigned, task.started, task.review_requested, task.completed,
  task.failed, task.returned_to_inbox
- router.started, router.stopped, router.error

## 5. ActivityStore API

`open`, `append`, `listEvents`, `has`, `deliveredToday`, `isCapped`, `flush`, `close`.
Newest append first, limits 1–100, cursor/type/entity/agent/task filters. Records are
cloned. Unknown/expired cursor returns an empty page. Append and close are serialized.

## 6. ActivityPublisher API

`publish(input, once?)`, `subscribe`, `subscribeStatus`, `status`, `flush`, `close`.
Validates/clones input, generates identity and monotonic time, appends, then notifies.
Explicit once mode deduplicates queued/delivered message facts in retained history.
Failures return null to preserve domain success; subscriber failures are isolated.

## 7. Persistence

`DATA_DIR/events.jsonl`, one complete JSON event/newline per append, one process-owned
queue, write awaited and handle closed. New file mode 0600. Graceful shutdown drains
domain activity and storage. No per-event fsync or transactional coupling. Restart
loads validated history; invalid lines/duplicate IDs are skipped, reported and preserved.
Incomplete tails are separated before future records, not rewritten.

## 8. Failure semantics

Domain mutations succeed when activity fails. Safe structured diagnostics accompany
failure. Three consecutive append failures, corruption/read warnings or a file cap
produce degraded REST/live status and UI notice. Successful writes reset append-failure
streaks. Unreadable history degrades Activity rather than preventing domain startup.

## 9. Privacy

No message body, task description, terminal input/output, file content, environment or
provider secret is logged. Strict schema rejection and API/body/description/fake-PTY
sentinel tests verify this. Only names/titles/IDs, message routing/type and safe error
codes are recorded. User names/titles should not themselves contain secrets.

## 10. Retention

32 MiB hard file cap; recording stops and degraded status explains missing activity.
No compaction or automatic repair. Last 10,000 valid events are indexed; earlier bytes
remain on disk. Cursor availability, queued/delivered once-deduplication and recorded
UTC-today delivery counts are limited to this retained history. Rotation requires
stopping the server and preserving the old file before restart.

## 11. REST

`GET /api/activity?limit=50&cursor=evt-…&type=task.assigned&agentId=nova&taskId=task-…`
validates every query field and returns `{events,nextCursor,status}`. Optional
`entityType` groups families. No POST event endpoint exists.
`GET /api/activity/summary` returns supported current runtime/task counts and retained
UTC-today message delivery count, without fabricated percentages or scores.

## 12. Live architecture

Domains → safe composition adapters → Publisher → Store → REST / `/ws/activity` →
validated client → page-local bounded UI. Read-only WebSocket frames are activity.event
and activity.status. Unknown/missing origins are rejected, client data closes with
1008, >256 KiB pending output terminates slow clients, shutdown disposes connections.
Five reconnect delays and a five-second handshake bound lead to explicit Retry.
Each connection takes a fresh REST snapshot while buffering/deduplicating live facts.

## 13. Agent integration

Registry owns committed creation/deletion/running/stopped/error observations; Runtime
adds only successful logical restart. Start/stop are never emitted by two observers.
Restart means physical stop/start then restart; stopped-agent restart means start then
restart. Idempotent stopped-agent stops produce no event. Unexpected PTY failure is tested.

## 14. Router integration

Queued is owned by the router after valid outbox read, covering fake CLI writes and
startup backlog without a second mailbox producer. Delivered follows publication and
acknowledgement. Duplicate watcher callbacks and recovered inboxes do not duplicate
retained delivery facts. Quarantine and failure contain safe codes and routing IDs only.
Watcher startup/stop/errors produce useful lifecycle facts; detected callbacks do not.

## 15. Task integration

Only committed TaskRegistry events publish facts. Task create/assign/start/review/complete
is ordered and exactly once. Active-assignee deletion maps internal task.unassigned to
returned_to_inbox. Invalid/repeated task transitions do not create success facts.
No mailbox result or fake agent controls task state.

## 16. Activity frontend

Activity reuses the incumbent feed frame with readable formatter, type icons/colors,
links, ISO tooltips and relative times refreshed every 30 seconds. All/Agents/Tasks/
Messages/System filter the loaded bounded page. Loading, empty, error, retry and degraded
states are explicit. Older pages replace the bounded view; Latest activity restores
recent history. No raw event JSON or browser-created facts are shown.

## 17. Dashboard and audit

| Existing area                              | PR 13 behavior                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Activity route                             | Real timeline replaces Not built yet                                                                    |
| Team Activity / typed mock file            | Latest five real matching events; mock removed                                                          |
| Home sync indicator / active count         | Actual activity connection state and registry status                                                    |
| Swarm Telemetry metrics                    | Team Overview: active runtimes, completed UTC-today tasks, Working tasks, retained UTC-today deliveries |
| Hardware/latency numbers                   | Not measured / em dash, no invented readings                                                            |
| Activity icons/colors                      | Canonical type mapping using existing palette and Material Symbols                                      |
| Agent avatars                              | Existing agent avatar treatment unchanged; feed keeps its original icon circles                         |
| Task/agent links                           | Real task deep links and registered agent profile links                                                 |
| Timestamp strings                          | Real event ISO tooltips plus lightweight relative copy                                                  |
| Other operative cards / planner / composer | Explicit DESIGN PREVIEW operative section; existing mocks deferred                                      |

The app shell does not subscribe to every event. Only Activity/Home page state changes;
summary refreshes are briefly debounced. Browser visible history is capped at 100.

## 18. Tests

Activity coverage includes strict schema/privacy, 100 concurrent mixed publications,
unique IDs/complete lines/order/reload, cursor filters and cloning, corruption/duplicates/
incomplete tails, cap/read/write failures/recovery, restart message deduplication,
agent lifecycle and unexpected exit, ordered task flow/deletion, duplicate filesystem
delivery and quarantine, successful domains during logging failure, supported counts,
REST/origin/read-only/shutdown behavior, actual fake-agent round trip and no terminal
line events, client REST/WS validation, reconnect/exhaustion/disposal and bounded merge.
Browser tests create/start an agent, create/assign/start a task, verify real links and
live updates without page reload, return to Dashboard, reload history, and exercise
filters/connection retry. All fixtures use disposable DATA_DIRs.

## 19. Repeated focused results

Final focused suite: 22 tests in four files, five consecutive successful runs.
Earlier pre-hardening run also passed 19 tests five times; final results supersede it.

## 20. Design parity

42/42 across 1280, 1440 and 1920 px. The Home fixture uses the real task seeding flow,
then verifies the five canonical facts and exact task/agent metadata. The approved
reference frame gets intentional canonical copy/type icons/colors and real metric copy,
matching the product change. Only relative event time is normalized in the live capture;
ISO tooltips are checked. No timeline rectangle is masked, cropped or tolerance-raised.
All original timeline frames, borders, spacing, wrapping and geometry are pixel-compared.
The existing PR 12 task-frame and terminal-content comparison policies remain unchanged.

## 21. Full suite

Format, lint, typecheck and build pass. Vitest: 490 tests in 40 files.
Full browser suite: 68/68, one worker, zero retries. Design: 42/42.

## 22. Disposable manual verification

`npm run activity:smoke -w @qelvra/server` starts an isolated app, opens the actual live
socket, creates/starts Nova and Atlas with fixed fake providers, creates/assigns a task,
sends a message through the real PTY, waits for the returned message, completes the
real task lifecycle and checks REST/summary/live facts. It closes/reopens the server
and checks every prior event ID, complete JSONL and absence of private sentinel data.
Result: 17 persisted events, 14 observed live events, zero duplicate IDs, no private
body/description/terminal content, no temporary publications, zero leaked demo PIDs.
Demo DATA_DIR is removed. Developer Kite data/workspace is preserved.

Read-only desktop and 390px browser inspection confirmed usable type/link/time states;
feed filters wrap and event content stacks at narrow widths. The inherited fixed sidebar
and desktop header still constrain the whole app on mobile; this PR does not redesign
the global shell. The developer server and web app remain on ports 3001 and 5173.

## 23. Known limits

- One writer/app process per DATA_DIR; no interprocess append coordination.
- No fsync/power-loss transaction guarantee, domain replay, guaranteed stream replay or
  atomic commit with domain state. Successful domain facts can be missing after failures.
- Hard file cap requires operator rotation; API history and message deduplication use
  the last 10,000 valid events. Delivery counts are retained facts, not accounting totals.
- Filter controls apply to the currently loaded 100-event page; new facts can evict older
  visible records. Latest activity/reconnect restores recent REST history.
- Names/task titles are recorded labels. Deleted-entity history may link to a normal 404.
- Existing operative previews, composer/planner, provider execution and orchestration
  remain deferred. Global mobile shell responsiveness is outside PR 13.

## 24. Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
# Execute the following focused command five consecutive times:
npx vitest run tests/unit/activity-schema.test.ts tests/unit/activity-store.test.ts tests/unit/web-activity.test.ts tests/integration/activity/activity.test.ts
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
npm run activity:smoke -w @qelvra/server
```

## 25. Commit SHA

The final pushed SHA is provided in the completion message. Retrieve the implementation
commit from history with `git log -1 --format=%H --grep='feat(activity): add persistent realtime activity stream'`.

## 26. GitHub CI

The final completion message links the Actions run for the exact pushed SHA. Both check
and e2e jobs must pass before PR 13 is reported complete. CI executes format/lint/
typecheck/test/build and browser tests; design parity is the separately verified local
42-screen suite, not a claimed GitHub job.

## 27. Commit message

`feat(activity): add persistent realtime activity stream`
