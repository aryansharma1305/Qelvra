# ADR 0020: Read-only retained Activity analytics

Status: Accepted (v0.2 development)

## Source and boundary

AnalyticsService observes the existing ActivityPublisher and ActivityStore. It
flushes queued observations, gets a defensive validated/deduplicated retained
snapshot, and aggregates it. GET `/api/analytics` is the only Analytics route.
There is no Analytics journal, database, persistent counter, domain mutation,
provider request or remote telemetry. Reads do not publish Activity events.
Flushing can finish already queued domain observations; Analytics itself never
appends to the journal.

ActivityStore keeps the newest 10,000 events and caps `events.jsonl` at 32 MiB.
The minimal snapshot accessor returns cloned retained events, count, timestamp
bounds and whether retention discarded older entries. It cannot expose mutable
internals. Restore keeps existing validation/deduplication and preserves corrupt
bytes. Analytics does not independently read or repair the journal.

## Query and time semantics

Strict shared Zod query/response schemas reject unknown fields. Optional `from`
and `to` accept ISO UTC timestamps ending in Z or YYYY-MM-DD UTC dates. Dates mean
UTC midnight. The interval is `[from, to)`: start included, end excluded. The
maximum elapsed range is exactly 90 × 24 hours. With neither bound, use the last
seven elapsed days ending at server now. A missing `to` defaults to now; a missing
`from` defaults to seven days before `to`. Empty/reversed/invalid/oversized ranges
return ANALYTICS_INVALID_QUERY (400). A valid but unregistered agent filter returns
AGENT_NOT_FOUND (404). The real registry populates UI filters.

Each UTC day intersecting the interval appears, including zero counts and partial
boundary days. A rolling 90-day interval can intersect 91 UTC dates; an exact
midnight-to-midnight interval of 90 days has 90 buckets. Presets are rolling last
24 hours, seven days and 30 days; custom dates have an explicitly exclusive end.

## Count semantics and association

Counts describe unique recorded event identities within the retained snapshot,
not unique tasks/projects, current domain state, complete lifetime operations or
an invented success percentage. All valid types aggregate dynamically, ordered
by count descending then type name. Task outcome categories count task.completed,
task.failed, task.review_requested and task.returned_to_inbox. Goal terminal
outcomes count orchestration.completed, orchestration.failed and
orchestration.cancelled. Plan/rework observations remain visible in the complete
type breakdown; they are not silently counted as terminal goal outcomes.

The existing Activity agent association is extracted into activityAgentIds and
shared by Activity filtering and Analytics: agent entity, agent actor, metadata
agentId/assigneeId and message sender/recipient. Each agent counts once per event.
An event can involve multiple agents, so involvement totals may exceed the global
event count. Filtered results retain all participants in matching events. Registry
names/roles annotate known agents; historical deleted/unknown IDs, including
control-mailbox participants, are retained with null names/roles and a visible
unregistered label. No names are copied from raw historical event metadata.

## Coverage and privacy

Responses expose unfiltered retained count/timestamp bounds, current recording
status, health and warnings for retention loss, range before oldest retained
event, journal cap, integrity warnings and recording failures. A single current
recording failure is reported even before the publisher's three-failure degraded
threshold. A successful later recording can clear consecutiveFailures; current
health is not a promise that earlier missing operations were recovered. The UI
always states that retained history is not guaranteed lifetime truth.

Responses contain counts, timestamps, valid type names and safe registry agent
IDs/names/roles only. They never contain task descriptions/titles, prompts, memory,
message bodies, terminal output, environment data or file contents/paths. Analytics
does not log those values or read memory/workspace files. Token usage, provider
cost and machine utilization use explicit null/unavailable semantics.

## UI and performance

The existing Qelvra shell/tokens supply filters, primary Refresh, four real summary
values, a UTC bar chart and equivalent daily table, type/outcome tables, agent
involvement and visible coverage. No chart dependency is added. Chart/tables can
scroll inside their containers on mobile. Loading, empty, initial error/Retry and
last-known snapshot on refresh failure are explicit. There is no Analytics polling.

Aggregation uses a bounded snapshot and a linear event pass, with final small
type/agent sorts and at most 91 day buckets. It does not cross-multiply events,
registered agents and event types. Tests use disposable storage, cover 10,000
retained events, restart, source-byte/mtime preservation, coverage and privacy.
The released beta tag and actual Kite data remain unchanged.

## Direction contract

THESIS: Make recorded activity understandable while keeping its limits visible.

OWN-WORLD: Preserve the incumbent dark Qelvra shell, Geist interface, existing
surface/border/radius tokens, lavender primary controls and cyan data bars.

STORY: Select a UTC interval and real agent, inspect counts and daily activity,
understand type/outcome involvement, then check source coverage before drawing
conclusions. Refresh explicitly when needed.

FIRST VIEWPORT: Analytics heading and source description, wrapped date/agent
controls, actual loaded interval, four recorded-count summaries and the chart.
Mobile stacks summaries and keeps horizontal chart scrolling inside its panel.

FORM: Accessible SVG geometry and native table/details controls; no imagery,
invented metrics, animation decoration or unrelated visual-system changes.

SIGNATURE: Coverage stays part of the answer. Failure retains the last known
snapshot with its actual loaded interval; multi-agent counts disclose overlap.
