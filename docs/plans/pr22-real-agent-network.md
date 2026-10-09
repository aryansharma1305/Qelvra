# PR 22: Real Agent Network — source audit and implementation plan

Status: Proposed; audit only. No Network implementation is included in this commit.

Audit date: 2026-10-09. Baseline: `main` at
`0cf2ff5d98a2f2f6c4f3496a610308a6dffc61e4`, after merging Settings PR #4.
Working branch: `codex/pr22-real-agent-network`.

## Goal and boundary

Replace `/network`'s static demonstration with an observational view of registered
agents and evidenced relationships. A relationship must explain its source and
meaning. Agent selection opens read-only details and links to the existing real
agent detail route. Nothing on this page sends a message, edits a graph, controls
an agent, assigns a task, or starts orchestration.

No new persistence, snapshot migration, communication behavior, graph-layout
dependency, provider execution, telemetry collection, shared workspace, or
automation is required. Preserve the released `v0.1.0-beta.1` tag and user data.
Automations remain PR 23; Shared Projects/Git worktrees remain PR 24+.

## Audited sources

| Source              | Existing seam                                                                                                  | What it can honestly supply                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry            | `apps/server/src/agents/agent-registry.ts`: `list()` / `get()`; shared `agent.ts`                              | Registered IDs, current names/roles, lifecycle status, configured provider ID, creation/update timestamps. Frozen records; registry is the sole node identity source.                     |
| Runtime             | `apps/server/src/agents/agent-runtime-manager.ts`: `list()` / `get()`                                          | Whether an agent currently has a PTY, its start time and viewer attachment. A live shell does not prove an active AI execution or provider authentication.                                |
| Tasks               | `apps/server/src/tasks/task-registry.ts`: `list()`; shared `task.ts`                                           | Current single assignee, status, ID/title, update timestamp. `createdBy` is always `user`; there is no agent-to-agent task issuer field.                                                  |
| Orchestration       | `apps/server/src/orchestration/orchestration-service.ts`: `list()`; shared `orchestration.ts`                  | Explicit orchestrator ID and materialized task slots with worker agent IDs, task IDs and plan keys; goal status and timestamps. Draft plans do not assign workers.                        |
| Router observations | `apps/server/src/activity/domain-events.ts`: `recordRouterActivity()`; shared `activity-event.ts`              | `message.queued`, `message.delivered`, `message.quarantined`, `message.delivery_failed` observations with sender, optional recipient, optional message ID/type, safe error code. No body. |
| Retained history    | `apps/server/src/activity/activity-store.ts`: `getSnapshot()`; `activity-publisher.ts`: `flush()` / `status()` | Validated, deduplicated retained events, retention timestamp bounds/truncation and recording health. At most 10,000 retained events; journal cap is 32 MiB.                               |
| Providers           | `apps/server/src/providers/provider-registry.ts`; shared `provider.ts`                                         | Configured provider ID comes from the agent. Discovery `list()` may spawn CLI probes when its cache expires; avoid it in Network snapshot reads. There is no per-agent model field.       |
| Existing transport  | `apps/web/src/features/activity/activity-client.ts`                                                            | Validated Activity WebSocket, reconnect/status callbacks and latest REST snapshot. Suitable for invalidating a Network snapshot, not a complete historical graph source by itself.        |

The generic Activity association helper is useful for involvement counts but is
**not an edge builder**: two IDs associated with one event do not necessarily
communicate. Message edges must use explicit `metadata.from` / `metadata.to`.

The current Network components (`NetworkHeader.tsx`, `MeshGraph.tsx`,
`NodeTelemetryPanel.tsx`, `IpcTimeline.tsx`) contain hardcoded Michael, Nova,
Atlas, Scout, Pixel and Echo, sample tasks/providers/payloads, animated traffic,
protocol/shared-RAM badges and unimplemented controls. Replace these together;
do not retain a sample sidebar or timeline underneath real nodes.
`components/shell/AppShell.tsx` currently marks `/network` as a preview. Remove
only Network from that preview list once the implementation is ready.

## Mailbox decision

`MailboxManager.listMessages()` enumerates the entire directory and reads each
validated message, including its body. Individual files are bounded, but the
listing has no entry-count/page bound. Messages can disappear when acknowledged;
the current directory is not durable delivery history. The reserved `system`
control mailbox is not a registered agent.

Use the existing router's retained Activity metadata for message relationships
in PR 22. Label it **recorded message activity**, never current queue depth,
unread count, acknowledgement, guaranteed delivery, or complete lifetime traffic.
Do not scan inbox/outbox/quarantine directories or add a new mailbox index.
Pending-mailbox inventory is outside this observational first pass.

## Relationship semantics

1. **Nodes:** current registered agents, including disconnected/stopped agents
   and agents with no edges. Names/roles come from the current registry. The
   configured provider ID and PTY presence are separate facts; no guessed model,
   token count, authentication, inferred execution, or throughput.
2. **Message edges:** directed sender → recipient, only when both endpoints are
   registered and the event falls inside the selected interval. Group by ordered
   pair; retain separate queued/delivered/quarantined/failed observation counts
   and last observed time. Deduplicate event IDs; for a known message ID count
   each lifecycle type once per pair/message. Events without a message ID remain
   explicitly observation counts. Queued and delivered are not two distinct
   messages, and a failure observation is not necessarily a permanently failed
   message. Do not calculate RTT or success rate. Self-messages remain node
   observations rather than decorative graph loops.
3. **Orchestration edges:** a distinct, non-traffic relationship between the
   persisted orchestrator and each materialized slot's worker. Group by pair,
   preserve goal/task references, and label participation, not message delivery.
   Distinguish current nonterminal goals from recently updated terminal goals.
   A planned draft without slots only annotates the orchestrator node. Do not
   build a clique between workers, invent delegation direction, or infer a live
   communication channel from plan dependencies.
4. **Task assignments:** read-only node details/counts. Include nonterminal
   assigned tasks regardless of age, plus completed/failed assignments updated
   within the selected interval. A single-assignee task does not create an
   agent-to-agent edge. Link to the existing task surface with a supported route,
   not an invented task-detail URL.
5. **Missing/old participants:** no ghost, system, user, deleted-agent, or sample
   nodes. Report omitted relationship evidence in coverage. IDs can be reused
   after deletion: exclude historical message observations predating either
   current agent's `createdAt`; exclude old terminal task associations predating
   the current assignee registration. For goal membership use a conservative
   registration guard against goal creation, disclosing omitted older membership
   rather than attributing an old ID to a newly registered agent. Do not change
   identity persistence to solve this in PR 22.

## Bounded projection and API proposal

Add one strict shared query/response contract and one server read-only projection
service, exposed as GET `/api/network`. This is justified because the existing
agent/task/goal lists return full records without page bounds, goals include
execution results, and browser aggregation would need to paginate history and
combine independent requests. A projection supplies small allowlisted records,
explicit limits and one observation timestamp without changing those APIs.

- Query: only `window=1h|24h|7d` (default `24h`). Reject unknown fields, invalid
  values and duplicate/array query values. No arbitrary paths, provider commands
  or client-selected limits. Resolve UTC `[from,to)` once from server now.
- Flush already queued Activity observations, then take the retained snapshot
  and synchronous defensive registry/runtime/task/goal copies without an await
  between domain reads. This is a best-effort combined observation, not a
  transactional snapshot across independent persistence files.
- Current node metadata is as observed now; recent messages are windowed history.
  Nonterminal tasks/goals are current state even if older than the window;
  terminal tasks/goals qualify by `updatedAt` inside `[from,to)`. Describe that
  distinction beside the interval control.
- Maximum 100 returned nodes; stable ID ordering. Maximum 200 typed aggregate
  edges whose endpoints are in the returned node set; newest evidence first,
  with stable type/endpoint tie breaks. Aggregate before applying edge limits.
  An omitted node never leaves a dangling edge. A large registry shows an
  explicit limit notice and a link to the Agents directory.
- Bound detail records to 20 tasks and 20 goals per node and the message timeline
  to 50 newest eligible observations. Return full eligible counts separately
  from shown counts so a sliced list never masquerades as a total. Do not
  cross-multiply all agent pairs; use maps/sets and linear source passes.
- Return only identity/status/provider ID, PTY presence/start/attachment,
  task/goal ID/title/status/update time, edge evidence counts/timestamps and
  safe message lifecycle metadata. Strip descriptions, plans/review text/results,
  prompts, bodies, memory, workspace paths/content, terminal data, environment,
  commands, executable paths, PID and session IDs.
- Coverage includes retained count/time bounds, requested range, Activity status,
  warnings for retention loss, interval before retained history, integrity,
  journal cap and any recording failure, plus node/edge/detail/timeline limits
  and omitted evidence. Empty relationships mean no eligible evidence retained,
  not proof that agents never communicated.
- No read-triggered Activity publication, provider detection/refresh, mailbox
  ensure/write/acknowledge, execution, scheduler wake, repair or data migration.
  Flushing finishes pre-existing observations; it does not create Network events.

## UI proposal

Keep the incumbent Qelvra shell, typography and tokens. Show a heading, actual
loaded UTC interval, the three window presets, Refresh, registered-node and
recorded-relationship counts, source legend and visible coverage notices.
Remove unsupported physics, steering, payload search, protocol, RTT and fake
task selectors instead of leaving inert controls.

Use a deterministic SVG relationship view with native linked/keyboard-operable
node cards in a bounded scrollable region; no force-layout dependency or animated
particles suggesting live traffic. Use distinct labelled styles for message
direction and orchestration participation. Selection exposes the real node's
read-only details and an **Open agent** link to `/agents/:agentId`. Provide an
equivalent relationship/agent list on mobile and as a desktop view choice; no
information should depend on hovering a line or seeing its color.

Show real loading, no-agents, agents-with-no-relationships, initial error/Retry,
and stale-last-success states. A failed refresh preserves the previous snapshot
with its loaded range and timestamp. Abort obsolete requests when switching
windows; an older response cannot overwrite the newer selection.

Reuse Activity transport to debounce relevant agent/task/orchestration/message
events and reconnect snapshots into a refetch, not mutate graph truth locally.
Coalesce in-flight refreshes. A visible-page 10-second fallback refresh handles
unrecorded changes, stale recording and sliding windows; stop polling when hidden
or unmounted. Disconnect/recording failures must not leave a misleading Live
badge. Runtime metadata may change without an Activity event, so it needs that
fallback. No new WebSocket protocol or persistent frontend store is necessary.

## Implementation sequence after this audit

1. Add shared Network contracts and pure projection logic with an injected clock;
   implement the read-only service/GET route using the existing accessors.
2. Add the validated client method and lifecycle-safe snapshot hook; reuse
   Activity invalidation without duplicating message routing behavior.
3. Replace all four mock components with real graph/list/detail/timeline states;
   remove Network's preview notice, preserve other preview pages.
4. Add focused tests, update Network navigation/design expectations, and document
   the accepted semantics in ADR 0022 and the implementation verification report.
5. Run required repository validation, inspect desktop/mobile UI, publish the
   implementation PR against fresh main, and report exact-head hosted CI.

## Acceptance and verification plan

- Deterministic fixtures: zero/one/many real agents; stopped and running PTYs;
  isolated nodes; messages both directions/self/system/deleted/reused IDs; all
  lifecycle types; duplicate IDs/message lifecycle records; missing destinations.
- UTC start included/end excluded and all presets with an injected clock; old
  current assignments retained, old terminal history omitted. Goal draft vs
  materialized membership; multiple goals/tasks for a pair; no worker clique.
- 10,000 retained events and over-limit nodes/edges/details; exact eligible vs
  displayed counts; deterministic ordering; no dangling endpoints; retention,
  corruption/cap/failure warnings; no false completeness or delivery claims.
- Integration in disposable DATA_DIR: strict query validation and response
  schemas, restart projection, source bytes/mtime preservation. Spies prove no
  mailbox reads/writes, provider probes, PTY/process control, new Activity events
  or orchestration actions from Network GET.
- API/privacy fixtures place sentinel content in task descriptions, message
  bodies and goal results; assert it and runtime session/PID/path data never enter
  the response or logs. Do not use actual user workspaces/memory for tests.
- Browser coverage: load/empty/error/stale/Retry, bounded lists, window races,
  refresh/coalescing/disconnect, keyboard selection and real agent navigation,
  mobile list without page overflow. No Network control issues a domain mutation.
- Replace the `/network` static Stitch parity case in
  `tests/design/parity.spec.ts` and its Network-specific preview transforms in
  `tests/design/beta-parity.ts` with deterministic real-data desktop/mobile checks.
  Do not mask the entire graph or weaken other route parity tests. Update
  `tests/e2e/navigation.spec.ts` only for the real Network heading.
- On implementation: formatting, lint, typecheck, build, unit/integration, E2E,
  design and applicable production/release checks; exact-head hosted CI. The
  audit-only commit requires Markdown formatting and diff checks, not runtime
  tests or a claim that PR 22 is implemented.

## Audit outcome

The existing validated in-memory sources are sufficient. No domain changes or
new persistence are needed. The key limitation is that mailbox traffic is
**retained recorded evidence**, while task/goal participation is **persisted
assignment metadata**; neither is a live shared-RAM mesh. Implementation can
proceed on this boundary after the audit/plan review.
