# PR 20: Analytics commencement

Status: source audit and implementation plan; Analytics is not implemented yet.
Branch: `codex/pr20-real-analytics`, starting at merged main
`e89264a2963ba91ed39824dcfed09c4357c41d99`.

## Completed merge sequence

- Files [PR #1](https://github.com/aryansharma1305/Qelvra/pull/1) merged first at
  `8ff810c8e9c70179d847e6f09a43aea5fe44822a`.
- Memory [PR #2](https://github.com/aryansharma1305/Qelvra/pull/2) rebased onto main
  and retargeted to main. Its rebased head was
  `ee287a58a12c34903978a80b2e4746afca3320c5`; the source tree matched its original head.
- [Fresh CI](https://github.com/aryansharma1305/Qelvra/actions/runs/37796722397)
  passed before Memory merged at `e89264a2963ba91ed39824dcfed09c4357c41d99`.
- Local main was fast-forwarded after each merge. The beta tag was not moved.

## Source audit

`/analytics` is an explicit not-built-yet route in `apps/web/src/app/router.tsx`.
There is no approved Analytics page or real Analytics endpoint to preserve.
The existing shell, Activity page, fonts, tokens and controls provide the visual system.

ActivityPublisher serializes validated observations, flushes pending writes and
exposes recording health. ActivityStore restores validated/deduplicated records
from `events.jsonl`, caps the journal at 32 MiB and retains the newest 10,000 valid
events in memory. Its public listEvents returns at most 100 events per page.
The shared Activity schema currently covers 41 event types. Domain operations
remain available when event recording fails; therefore Analytics must not claim
every domain action was recorded.

Existing agent filters include direct agent entities, agent actors, agentId,
assigneeId and message sender/recipient metadata. Analytics should preserve those
association rules. A message can involve two agents; per-agent counts should say
that they count involvement and need not sum to the global unique-event count.

Events contain allowlisted metadata rather than task bodies, memory contents,
terminal output or environment variables. Analytics should return aggregate
counts and safe identifiers, without introducing raw content or a new telemetry sink.

## Proposed initial implementation

1. Add a dedicated read-only Analytics service and strict shared query/response
   schemas, with a centralized validated frontend client.
2. Aggregate the existing retained Activity snapshot after flushing the publisher.
   Expose its retention boundary, recording health and integrity warnings. Add the
   smallest store-level snapshot/coverage accessor needed; avoid a second event store.
3. Support a bounded UTC date range and optional agent filter. Return daily event
   counts, counts by event type, task/goal outcome events and per-agent involvement.
   Name them as recorded events, not invented throughput, current task state,
   unique completed projects or lifetime totals.
4. Preserve genuine zero counts. Label token use, AI cost and machine utilization
   unavailable unless a supported source actually records them. Do not infer cost
   from task counts or show fake performance data.
5. Replace the placeholder with a read-only page in the existing shell. Include
   date/agent filters, manual Refresh, an accessible daily chart with equivalent
   tabular values, outcome/type breakdowns, and clear coverage information.
6. Handle initial loading, empty windows, API failure, last-known snapshots,
   recording degradation and truncated history. No aggressive polling, writes,
   exports, tracking beacons or new third-party chart dependency in this first scope.

The initial scope was proposed to the user; a later PR 20 brief can refine it
before implementation. The current branch contains this plan only, with no runtime
or UI changes.

## Verification to implement alongside the feature

- Deterministic aggregation tests: UTC boundaries, zero buckets, duplicate event
  identity handling, multi-agent association, repeated outcome events and retained
  history limits. Test degraded/capped/corrupt source reporting honestly.
- Real API integration: strict filters, invalid date ranges, unknown query fields,
  privacy, store restart and unchanged source files after Analytics reads.
- Browser flows: real event generation changes counts on Refresh; date/agent
  filters work; empty/error/recovery states and recording warnings are visible.
- Desktop/mobile captures using the incumbent visual system; bounded design review.
- Format, lint, typecheck, unit/integration, build, zero-retry E2E/design/release UI,
  production smokes and hosted CI before the feature is ready to merge.

The existing beta release and real Kite data remain outside destructive tests.
