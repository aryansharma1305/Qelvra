# ADR 0013: Persistent realtime activity

Status: Accepted. PR 13 observes important committed domain facts. No real AI,
orchestrator decisions, task execution or advanced analytics are added.

## Schema and ownership

`packages/shared/src/activity-event.ts` defines strict Zod discriminated payloads:
server-owned `evt-<UUID v4>` and ISO timestamp, canonical type, optional actor,
typed entity and a strict family-specific metadata allowlist. Server timestamps are
monotonic milliseconds within the publisher, seeded from the latest retained event;
a burst or a backwards clock can put the logical timestamp slightly ahead of wall time.

| Owner                                                                      | Facts                                                                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AgentRegistry committed creation/deletion/status                           | agent.created, agent.deleted, agent.started (running), agent.stopped (stopped), agent.error (error)                                              |
| AgentRuntimeManager successful restart callback                            | agent.restarted only                                                                                                                             |
| TaskRegistry committed transitions                                         | task.created, task.assigned, task.started, task.review_requested, task.completed, task.failed, task.returned_to_inbox (internal task.unassigned) |
| MessageRouter validated observation/publication/acknowledgement/quarantine | message.queued, message.delivered, message.delivery_failed, message.quarantined                                                                  |
| MessageRouter actual watcher lifecycle                                     | router.started, router.stopped, router.error                                                                                                     |

The registry's committed runtime status is the sole start/stop/error observation.
Runtime does not publish these a second time. A restart records the physical stop
(if running), the physical start, then one successful logical restart; a stopped agent
restarted records start then restart. Repeated stopped-agent stops add no event.
Creation rollback can legitimately record created followed by deleted: registry
metadata really committed, then the workspace initialization failed.

Router emits queued only after reading a valid outbox envelope, so child fake-agent
writes and startup backlog are observed without competing MailboxManager emitters.
Missing or malformed files do not become queued facts. Delivery records follow inbox
publication and source acknowledgement. Existing-inbox recovery is a delivery fact.
Publisher's explicit once mode deduplicates queued/delivered by type + message entity
within retained history, including restart. It never deduplicates legitimate task or
agent transitions. Failed/quarantined events can repeat on explicit retries; malformed
filenames may have no message entity. Generic filesystem detected callbacks are not logged.

## Append-only store and publisher

One app/process owns `ActivityStore` and `ActivityPublisher`. Domains use composition
adapters, not filesystem writers. `publish(input, once?)` validates and clones input,
serializes creation/append/notification, and resolves an event or null on failure.
Subscribers see only successfully appended validated events; throwing observers cannot
break domains. `subscribe`, `subscribeStatus`, `status`, `flush` and `close` are minimal
in-process APIs. Domains schedule publication and never await disk I/O in delivery.

The store appends a complete JSON object plus newline through one queue, awaits the
write and closes the file handle on each append. It creates new files with mode 0600.
`flush` drains queued writes; app close drains router, runtime and PTYs before the
publisher closes. No fsync-per-event, database, archive or interprocess lock is used.
Successful writes reach OS buffers; power loss can lose recent writes. A process crash
or failed write can leave an incomplete tail. There is no transactional guarantee with
domain files: a crash or append failure between domain commit and observation can lose
a fact, and there is no domain replay/reconstruction. This tradeoff keeps the router
from waiting on disk flushes and makes activity observational rather than authority.

`listEvents` is newest append first, with limit (50 default, 100 maximum), cursor,
canonical type, agent/task and entity filters. It returns cloned records and nextCursor.
Expired/unknown cursors yield an empty page. Timestamp tie-breaking in the browser is
stable; publisher monotonic timestamps preserve append order for normal writes.

## Corruption, failure and retention

Startup validates each line, skips invalid lines or duplicate event IDs, and reports
integrity warnings without logging the line. It never rewrites corrupt bytes. A missing
final newline is separated before the next record, preserving an incomplete tail for
inspection. Read failures degrade Activity rather than prevent domain startup. After a
failed append, disk-size accounting is refreshed and an uncertain tail is separated.
No automatic repair or compaction is attempted.

Activity errors are logged as safe structured error codes. Original domain mutations
succeed. Three consecutive append failures, any integrity warning, or a reached cap
expose degraded status in REST and the live status channel. A successful append clears
consecutive failures; integrity warnings persist until operator repair/restart. No raw
I/O error, private path, payload or validation input enters these diagnostic logs.

The hard file cap is **32 MiB**, including corrupt bytes. Recording stops at the cap;
domain operations continue and UI indicates degraded recording. Logs already larger
than the cap are preserved and refused for automatic loading/appending. An operator
must stop the server and preserve/rotate the log before restarting. Automatic archival
and compaction are deferred. The store indexes only the **last 10,000 valid events**;
older bytes are preserved but unavailable to API pagination. Message once-deduplication
and recorded-deliveries-today counts have this same retained-history scope. These are
not accounting-grade totals. A cursor can expire as history advances.

## Transport and UI

`GET /api/activity` validates limit/cursor/type/agentId/taskId/entityType, returns
`{events,nextCursor,status}`, and drains scheduled publications for a consistent read.
`GET /api/activity/summary` returns active runtime count, current completed tasks whose
updatedAt is UTC-today, currently Working tasks, and retained UTC-today delivery facts.
No browser endpoint accepts event creation, IDs or timestamps.

`/ws/activity` is independent from terminal protocol and reuses the installed WebSocket
plugin. Exact allowed origins are mandatory. Server frames are activity.event or
activity.status; application data sent by clients closes with 1008. Native ping/pong
needs no application payload. Connections terminate above 256 KiB buffered output,
on send errors, or at shutdown; subscriptions are disposed on close. Degraded status
is sent on connection and recording failures/recovery. Slow clients reconnect to REST.

Frontend validates every REST event and WebSocket frame. It opens the stream, fetches
latest REST, merges facts received during the snapshot, and renders live. Reconnect
uses five delays (500/1000/2000/4000/8000 ms), a five-second handshake bound, and a new
REST snapshot each time. After exhaustion the user can Retry. There is no guaranteed
replay or catch-up beyond retained REST pages. Feed state is page-local and capped at
100 events; the global app shell is not rerendered for every event. Older activity
replaces the current bounded page; Latest activity resnapshots recent events. New live
facts can evict older visible facts. Feed filters apply to the loaded page.

One formatter maps stable facts to readable copy, type icons/colors and entity links.
Times update every 30 seconds and retain their full ISO timestamp in title/dateTime.
Activity has honest loading/empty/error/retry/degraded states. Home shows five events
and supported counts, with unsupported hardware data shown as Not measured. Existing
operative cards remain explicitly marked DESIGN PREVIEW; those previews and existing
composer/planner, Studio, Network and Swarm mocks are outside this milestone.

## Privacy

Persisted fields are identity, event time/type, agent display name, task title/assignee,
message sender/recipient/type/ID and safe error codes. Strict schemas reject arbitrary
extra metadata, descriptions and large blobs. Events never capture terminal input or
output, message bodies, file contents, environment, API keys or provider secrets.
Activity does record user-provided display names/task titles, so users should not put
secrets in those labels. Names are snapshotted for task/agent history; message copy
uses stable agent IDs. Existing history can link to deleted entities' normal 404 page.

Tests cover schema privacy, 100 concurrent mixed publishes, reload, corruption,
append failures/recovery/cap, cursor filters, domain ownership, task ordering, duplicate
filesystem callbacks, unexpected process exit, read-only/origin transport, actual fake
PTY round trips without terminal-line events, frontend validation/reconnect/bounds,
real browser actions and full unmasked timeline screenshots with domain-seeded fixtures.
