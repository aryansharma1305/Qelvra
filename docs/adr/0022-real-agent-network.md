# ADR 0022: Observational Agent Network

Status: Accepted (v0.2 development)

## Sources and read boundary

GET `/api/network` projects the existing AgentRegistry, AgentRuntimeManager,
TaskRegistry, OrchestrationService and retained ActivityStore. Strict shared Zod
contracts validate query and response. It flushes already queued observations,
then takes synchronous defensive copies and an observation timestamp. This is a
best-effort combined snapshot, not a transaction across independent domain files.
Responses are `Cache-Control: no-store`.

No Network store, journal, provider discovery, mailbox index, layout dependency,
new WebSocket protocol or migration is added. Reads neither publish Activity nor
invoke routing, scheduling, execution, provider probes or domain mutations.
Mailbox contents, memory and workspaces are not read by this projection.

## Time and relationship meanings

The only query is `window=1h|24h|7d`, default `24h`, resolved as UTC `[from,to)`
ending at server now. Unknown, repeated, array and invalid query parameters are
rejected with 400. Current node metadata is separate from recent recorded history.
Nonterminal assigned tasks/goals remain eligible regardless of age; completed or
failed tasks and completed/failed/cancelled goals require `updatedAt` in range.

Nodes are current registry records, including isolated and stopped agents. Runtime
presence means a shell PTY exists; it is not proof of active AI execution,
authentication or a selected model. Provider ID is configured metadata, with null
meaning local shell. No graph read calls provider discovery.

Directed message edges require explicit registered sender and recipient IDs in
retained router Activity metadata. Each event ID counts once. For a known message
ID, each lifecycle type counts once per ordered pair/message; duplicate lifecycle
observations retain the newest timestamp (event ID breaks ties). Without a message
ID, distinct event IDs count as observations. Queued, delivered, quarantined and
delivery-failed counts remain separate. They are not unique-message totals, queue
inventory, acknowledgements, latency, live traffic or success rates. Self-messages
annotate the node and timeline, with no self-loop edge.

Orchestration participation is distinct from message traffic. Persisted
materialized slots connect the explicit orchestrator to a worker, grouped by that
ordered role pair. The visual has a dashed line without a message arrow. Goal/task
references are deduplicated; a draft or plan without slots only annotates its
orchestrator. No worker clique, dependency-derived channel or task-issuer edge is
invented. Tasks have one assignee and appear in node details.

Deleted/unregistered/system participants never become nodes. Message observations
predating either current registration are excluded. Task associations predating
the current assignee registration are excluded. Goal membership conservatively
requires registration no later than goal creation: legitimate workers registered
after a goal was created may consequently be omitted. This avoids attributing old
IDs to newly registered agents without altering the persistent identity model.
Omitted counts are participant references, not distinct-message counts.

## Limits, coverage and privacy

The server aggregates eligible evidence before slicing. Nodes sort by ID and cap
at 100. Typed edges sort newest-first, then kind/from/to and cap at 200 after
filtering to returned endpoints. Timeline observations sort newest-first then
event ID and cap at 50 after endpoint filtering. No edge or timeline record has a
dangling participant. Eligible node/edge/observation totals and displayed totals
are separate; eligible totals precede display caps.

Tasks and goals sort newest update first, then ID and cap at 20 per agent, with
full eligible totals. Orchestration references cap at 20 per edge and disclose
reference totals. All cap flags are visible, including omission due to node caps.
Projection uses maps/sets and source passes/sorts, not an all-pairs agent matrix.
The existing 10,000-event retained bound and 32 MiB authoritative snapshot startup
bounds remain unchanged.

Coverage includes source retention count/time bounds and publisher health.
Warnings cover retention loss, requested range preceding retained events,
integrity warnings, journal cap and even one recording failure. Healthy recording
is not a promise of recovered older failures or complete history. No observations
means no eligible retained evidence, not proof of no communication.

Explicit output construction exposes IDs/names/roles/status, configured provider
ID, PTY presence/start/viewer attachment, task/goal IDs/titles/status/update times,
participation, message lifecycle metadata and coverage. It excludes descriptions,
plans/reviews/results, bodies, prompts, secrets, memory, terminal output,
environment, executable/filesystem paths, PIDs and session IDs. Errors use safe
fixed validation text; no payload contents are logged by the projection.

## UI and lifecycle

The real page replaces the four mock components and removes only Network's
preview designation. The existing shell, fonts and tokens remain. Desktop offers
a deterministic scrollable SVG graph and native agent selection buttons, plus a
list choice and an always-available textual relationship list. Mobile uses the
agent list. Selection shows current runtime and bounded assignments, and links
to `/agents/:agentId`, `/tasks`, or `/tasks?view=goals` as appropriate. No controls
mutate domain records.

The hook keeps the last successful snapshot on failure, including its actual
loaded interval, and offers Retry. Window changes abort obsolete requests.
Existing Activity notifications invalidate the projection through one pending
150 ms timer, so sustained notifications cannot postpone refresh indefinitely.
In-flight work coalesces to at most one queued refresh. An independent 10-second
visible-page fallback handles unrecorded changes and moving windows.
Hidden/unmounted pages stop timers, dispose the Activity subscription and abort
requests; visibility return reloads. Notification connection state and recording
health are separate and never described as live traffic.

## Direction contract

THESIS: Inspect who is registered and what evidence links them, with limits beside
the answer.

OWN-WORLD: Preserve Qelvra's dark shell, Geist interface type, existing surface and
radius tokens, lavender actions/orchestration and cyan message geometry.

STORY: Choose a recent interval, inspect registered nodes and typed evidence,
select an agent to understand its current state and assignments, then check
coverage before interpreting a missing connection.

FIRST VIEWPORT: Heading, window/Refresh, loaded UTC interval and counts above the
relationship canvas; selected agent details alongside on wide screens. Mobile
stacks a native list before details and coverage, with local scrolling.

FORM: Accessible SVG geometry with equivalent text and native buttons/links.
No imagery, force-layout dependency, fake protocol labels or animated traffic.

SIGNATURE: Message arrows and orchestration lines stay semantically separate;
coverage and eligible/displayed totals remain part of the inspection.
