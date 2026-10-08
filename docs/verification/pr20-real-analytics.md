# PR 20: Real Analytics verification

Baseline: `e89264a2963ba91ed39824dcfed09c4357c41d99` (Files and Memory merged).
Branch: `codex/pr20-real-analytics`. Scope: read-only retained Activity insights.

1. **Files created (15).**
   `packages/shared/src/analytics.ts`;
   `apps/server/src/activity/activity-agent-ids.ts`;
   `apps/server/src/analytics/{analytics-service.ts,analytics-routes.ts,index.ts}`;
   `apps/web/src/pages/analytics/AnalyticsPage.tsx`;
   `tests/fixtures/{analytics-history.ts,analytics-service.ts}`;
   `tests/unit/{analytics.test.ts,web-analytics-api.test.ts}`;
   `tests/integration/server/analytics-api.test.ts`;
   `tests/e2e/analytics.spec.ts`; `tests/design/analytics.spec.ts`;
   `docs/adr/0020-real-analytics.md`; this verification report.

2. **Existing files modified (9 against main).**
   `README.md`, `docs/architecture.md`, `apps/server/src/activity/activity-store.ts`,
   `apps/server/src/app.ts`, `apps/web/src/app/router.tsx`, `apps/web/src/lib/api.ts`,
   `packages/shared/src/{api.ts,index.ts}`, `tests/e2e/navigation.spec.ts`.
   The branch's preliminary audit plan is replaced by ADR 0020 and this report;
   it does not appear in the final diff against main. No dependency, lockfile,
   version, release-note, provider or execution change.

3. **AnalyticsService API.**
   `new AnalyticsService(activity, registry, clock?).get(query = {})` returns a
   validated `AnalyticsResponse`. It validates filters, flushes already queued
   Activity observations, takes `ActivityStore.getSnapshot()`, then aggregates.
   Snapshot events are cloned, validated and deduplicated; the service neither
   reads the journal independently nor maintains persistent counters.

4. **REST contract.**
   Only GET `/api/analytics`; optional `from`, `to`, `agentId`. Invalid, duplicate,
   unknown or malformed query fields produce controlled 400
   `ANALYTICS_INVALID_QUERY`. A valid unregistered agent filter produces 404
   `AGENT_NOT_FOUND`. POST/PUT/DELETE have no Analytics route (404).

5. **Shared schemas.**
   Strict `AnalyticsQuerySchema`, `AnalyticsResponseSchema`, warning enum and
   `ANALYTICS_MAX_DAYS` are exported by shared. Counts are nonnegative integers.
   `getAnalytics` centrally validates requests and responses, including rejection
   of raw-event fields and invented measured-zero unavailable metrics.

6. **Date semantics.**
   UTC ISO timestamps ending in Z or YYYY-MM-DD dates (UTC midnight), `[from,to)`.
   Start included, end excluded, non-empty, maximum exactly 90 elapsed days.
   Default end is server now; default start is seven days before the chosen end.
   UI presets are rolling 24 hours, 7 days and 30 days; custom end is labeled exclusive.

7. **UTC buckets.**
   Every intersecting UTC date is returned in order, including real zero counts
   and partial boundary days. A rolling 90-day interval can intersect 91 dates;
   90 midnight-to-midnight days have 90 buckets.

8. **Event types.**
   All valid existing Activity types are counted dynamically, ordered by count
   descending then name. Future schema-supported types enter the same grouping;
   invalid journal types continue to follow Activity restore validation.

9. **Task outcomes.**
   Count `task.completed`, `task.failed`, `task.review_requested` and
   `task.returned_to_inbox` observations. Repeated observations count separately
   unless their event identity is duplicate. These are event counts, not unique
   tasks, current task state or lifetime completions.

10. **Goal outcomes.**
    Count `orchestration.completed`, `orchestration.failed` and
    `orchestration.cancelled`. Plan/rework events remain in the type breakdown;
    they do not inflate terminal outcome counts.

11. **Agent association.**
    Shared with Activity filtering: agent entity, agent actor, metadata agentId,
    assigneeId, message sender and recipient. IDs are deduplicated per event.
    Registry names/roles annotate known participants. Deleted/unknown historical
    IDs remain visible with null names/roles and an unregistered label.

12. **Multi-agent counts.**
    Each participant counts once per matching event. Involvement rows may sum to
    more than the global event count, explicitly disclosed in the page and ADR.
    Filtering by one agent retains all participants in that agent's matching events.

13. **Coverage and retention.**
    Unfiltered retained count and oldest/newest timestamps describe the source.
    Existing limits remain 10,000 retained events and a 32 MiB journal cap.
    Retention loss, pre-history ranges, journal cap and integrity warnings are
    visible. The page always states that retained history is not guaranteed lifetime truth.

14. **Recording health.**
    Current Activity status is authoritative. Even one consecutive recording
    failure generates a warning; corrupt/skipped records remain visible as
    integrity warnings. Later healthy recording does not prove historical missing
    observations were recovered. Domain operations can succeed without an event.

15. **Privacy and read-only guarantees.**
    Responses include counts, timestamps, type names and safe registry agent
    identities/roles only. Secret fixture metadata, task bodies/titles, memory,
    messages, prompts, terminal/environment data, paths and file contents are absent.
    Analytics has no telemetry or content logging. Integration tests compare
    every disposable data file's bytes and mtime before/after three GETs, including
    tasks, agents, memory, workspace and journal. Existing queued writes are flushed
    before the baseline; Analytics itself publishes no event and performs no migration.

16. **Unavailable metrics.**
    Token usage, provider cost and machine utilization are explicitly null and
    labeled “Not available yet”. No invented zero, productivity score or success rate.

17. **Frontend.**
    Incumbent Qelvra shell/tokens, wrapped date and real-agent controls, manual
    Refresh, loaded snapshot interval, four recorded summaries, UTC chart, type
    table, task/goal outcomes, agent involvement and coverage. No Analytics polling.

18. **Chart accessibility.**
    Dependency-free SVG with axis labels, UTC dates, real zero bars and an accessible
    image label. Native “Daily values (UTC)” details exposes every bucket in a table.
    Cards stack and chart/table scrolling stays within panels on mobile.

19. **Loading, empty and recovery.**
    Honest zero summaries and empty message; initial failure offers Retry without
    fabricated data. Failed refresh preserves last-known values and their actual
    interval/filter with a warning. Successful retry clears the warning.

20. **Performance.**
    A disposable 10,001-entry journal yielded exactly 10,000 retained observations.
    Real snapshot + aggregation + response validation measured **24.01 ms** locally.
    This is a single local sample, not a cross-machine guarantee. A near-limit unit
    test enforces a generous 1,500 ms regression budget. Aggregation uses a linear
    event pass, maps, bounded buckets and final type/agent sorts.

21. **Unit tests.**
    18 Analytics tests plus 2 centralized-client tests cover empty/single/mixed
    events, precision, 90-day boundaries, zero buckets, exclusive end, duplicates,
    all outcomes, deleted agents, multi-agent/filter parity, health/cap/integrity,
    privacy, immutable snapshots, strict queries and near-limit performance.

22. **Integration tests.**
    3 Fastify tests cover real retained history, strict query/write rejection,
    privacy, all-file bytes/mtime preservation, corrupt journal preservation,
    agent filters and actual app restart. All storage is disposable.

23. **Browser E2E.**
    6 Analytics cases cover real full-stack event generation and Refresh/filter,
    controlled UTC dates from a real ActivityStore/AnalyticsService fixture,
    zero range, stale snapshot/recovery, initial failure/Retry and source warning.
    No production test API or fake dashboard values are introduced.

24. **Restart.**
    Fastify is closed and reopened using the same disposable DATA_DIR. The selected
    historical range still yields seven events and private memory stays unchanged.
    Unit restore also verifies deduplication and journal byte/mtime preservation.

25. **Five consecutive focused runs.**
    All five passed **23 tests in 3 files** each, durations 980, 875, 911, 906 and
    910 ms. Runs used final source before the documentation-only report addition.

26. **Design parity.**
    Final desktop (1440px) and mobile (390px) captures were inspected together.
    The focused design test passed; the full suite passed **45 checks**, zero
    retries. Meaningful fixture counts/layout are not masked. The single scoped
    detector returned no findings. Fresh read-only finish reviewer and documenter
    cleared shipping without another visual pass. Existing documentation/token
    drift was left outside scope; no global tolerance or baseline was weakened.

27. **Full suite.**
    Format, lint, typecheck and build passed. **700 unit/integration tests in 65
    files**, **95 browser E2E**, **45 design checks**, **2 release browser tests**,
    production smoke and five-cycle release smoke passed. Browser suites ran
    sequentially with zero retries in an owned short disposable checkout `/tmp/q20`
    to avoid an existing terminal pwd-row assertion depending on long worktree
    paths. That assertion was unchanged. Hosted CI runs the same source on Linux.

28. **Known limitations and protected state.**
    Retained observations are incomplete lifetime evidence. Current health cannot
    prove past recording completeness. Outcome counts do not reconstruct state.
    Unknown historical participants appear globally but an unregistered filter
    is 404. No tokens, cost, hardware metrics, external tracking or analytics store.
    Tests do not use actual Kite, memory or workspace data. The beta tag remains
    `7bd5c0f09c15e2fca54c0dec1528c3fe6d9302e1`, peeled
    `a0f9f58185a7658f6b513de08913643696b51aed`. No PR 21 work is included.

29. **Exact verification commands.**

    ```bash
    export PATH=/Users/gugloo/.nvm/versions/node/v22.23.2/bin:$PATH
    for run in 1 2 3 4 5; do
      npx vitest run tests/unit/analytics.test.ts tests/unit/web-analytics-api.test.ts tests/integration/server/analytics-api.test.ts || exit 1
    done
    npm run format:check
    npm run lint
    npm run typecheck
    npm test
    npm run build
    CI=1 npm run test:e2e -- --workers=1 --retries=0
    npm run test:design -- --retries=0
    npm run test:release -- --workers=1 --retries=0
    npm run production:smoke
    npm run release:smoke
    ```

30. **Commit, PR and hosted CI handoff.**
    Feature commit title: `feat(analytics): add retained activity insights`.
    The final delivery and GitHub PR record the exact pushed commit SHA and the
    successful CI run URL tied to that SHA. This report is part of that feature
    commit, so its own hash cannot be embedded within itself. The PR targets main
    and remains open for review; completing this task does not merge PR 20 or tag a release.
