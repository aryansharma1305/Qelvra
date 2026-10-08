# PR 21: Real Settings verification

Baseline: `46066ce5eb61ffa38f675c126d0eb0f149a11f47` (Analytics merged).
Branch: `codex/pr21-real-settings`. Scope: effective read-only runtime state and
explicit provider rediscovery. The feature introduces no editable preferences.

1. **Created files (11 against main).**
   `packages/shared/src/settings.ts`; `apps/server/src/routes/settings.ts`;
   `apps/web/src/pages/settings/SettingsPage.tsx`; `tests/fixtures/settings.ts`;
   `tests/unit/{settings.test.ts,web-settings-api.test.ts}`;
   `tests/integration/server/settings-api.test.ts`; `tests/e2e/settings.spec.ts`;
   `tests/design/settings.spec.ts`; `docs/adr/0021-real-settings.md`; this report.

2. **Existing files modified (10 against main).**
   `README.md`, `docs/architecture.md`, `apps/server/src/{app.ts,config/env.ts}`,
   `apps/server/src/providers/provider-registry.ts`, `apps/web/src/app/router.tsx`,
   `apps/web/src/lib/api.ts`, `packages/shared/src/index.ts`,
   `tests/e2e/navigation.spec.ts`, `tests/unit/server-config.test.ts`.
   The branch's preliminary configuration audit is superseded by ADR 0021 and
   this report and does not appear in the final diff against main.

3. **Strict shared contracts.**
   `SettingsResponseSchema` validates General, Storage, Network and literal
   `restartRequired: true`. Extra fields, arbitrary environment names, invalid
   ports and fabricated enabled-authentication values are rejected.
   `EmptySettingsRequestSchema` accepts only an empty object.

4. **Runtime endpoint.**
   GET `/api/settings` accepts no query fields. Selected startup configuration is
   defensively captured; later caller changes cannot rewrite the displayed host
   or origins. After listening, the API port is the actual bound port. There are
   no POST/PUT/PATCH/DELETE Settings routes, persistence files or migrations.

5. **General identity.**
   Qelvra version uses the same SERVER_VERSION as health; Node version, platform
   and architecture come from the server process, not the browser or static text.
   The integration test compares the Settings and health version values.

6. **Environment.**
   ServerConfig retains the existing validated NODE_ENV value. Development,
   test and production remain distinct without returning or rereading raw process
   environment. Production behavior still uses the existing isProduction field.

7. **Storage.**
   DATA_DIR and workspaceRoot are selected resolved startup paths. The page
   explains that workspaceRoot serves developer scratch shells and that agents
   use isolated managed workspaces within DATA_DIR. Paths are read-only;
   changing configuration and restarting does not automatically relocate data.

8. **Network.**
   The page shows API host, bound port, normalized allowed web origins and
   loopback-only binding. The flag reuses the existing security policy for
   127.0.0.1, localhost and ::1; other configured hosts are not labeled loopback.

9. **Authentication and exposure.**
   API authentication is explicitly `not-enabled`. Non-loopback configuration
   displays a semantic warning against untrusted-network/public-internet exposure.
   Existing origin/Host checks are described as protections, not authentication.

10. **Provider source.**
    Existing GET `/api/providers` and ProviderRegistry remain authoritative. The
    page renders all returned providers, including Codex, Fake and other supported
    discovery definitions. No static provider-status list or alternative registry.

11. **Honest status fields.**
    Availability, detection reason, bounded version, authentication and automation
    capability come from the existing schema. Null versions say “Not reported”;
    unknown authentication says “Unknown”. Automation support is distinguished
    from availability/configuration/authentication needed to execute.

12. **Refresh contract.**
    POST `/api/providers/refresh` accepts no query fields and only an absent or
    empty-object body. It clears the existing discovery cache and reruns detection.
    It accepts no provider ID, executable, arguments, environment, credentials or
    settings values. It does not authenticate, install a CLI, launch an agent or
    execute a task. New responses use the existing strict provider schema.

13. **Coalescing.**
    Concurrent refresh requests share one in-flight operation and receive
    independent copies. Unit coverage sends 20 refreshes plus a list request;
    integration coverage sends ten simultaneous HTTP refreshes. Both observe
    exactly one discovery pass over seven definitions, with three probes at most.

14. **Discovery limits and cache.**
    Existing 60-second normal discovery caching, three-probe concurrency,
    three-second per-probe timeout and 65,536-byte output limit remain unchanged.
    Refresh is explicit; the Settings page does not poll. PATH is captured by the
    provider detector, so users must restart after changing PATH.

15. **Production Fake restriction.**
    Default production discovery continues to return Fake unavailable with
    DISABLED_IN_PRODUCTION. Both real detector integration and browser coverage
    verify the restriction. Settings does not provide a toggle to enable it.

16. **Failure containment.**
    Unexpected refresh failures return controlled 503 PROVIDER_DETECTION_FAILED.
    Raw probe errors/output are neither returned nor logged by the new route.
    Failed operations release the coalescing slot, allowing explicit retry.

17. **Read-only data evidence.**
    Three Settings GETs and three provider POST refreshes preserve every disposable
    data file's bytes and mtime after existing queued observations are flushed.
    Coverage includes agents, tasks, memory, workspace content and Activity journal.
    Neither endpoint publishes an Activity event or writes domain state.

18. **Privacy.**
    Responses contain only selected runtime/configuration and existing safe provider
    metadata. Tests exclude obvious secret environment, probe, task, memory and
    workspace strings. There is no raw environment dump, key editor, provider
    credential handling, telemetry, command options, terminal or content exposure.
    Selected storage paths intentionally remain visible on this local admin page.

19. **UI structure.**
    General → Providers → Storage → Network & Security, exactly as requested.
    The header explains read-only/restart semantics; provider rediscovery is the
    sole runtime action. No fake toggles, Save button or unused preferences.

20. **Accessibility and responsive behavior.**
    Semantic main, sections and headings; definition lists for runtime values;
    captioned provider table with row/column headers; labeled keyboard-scrollable
    overflow; explicit status/alert messages and focused/disabled button states.
    Values stack and long paths wrap on mobile. The header remains below the fixed
    shell, and no full-document horizontal overflow is allowed.

21. **Independent loading and recovery.**
    Runtime and provider requests load independently. Initial failures show Retry
    without fabricated values. Failed refresh keeps the last provider snapshot
    with a visible warning; recovery replaces it and clears the warning. A busy
    refresh disables the action while existing provider data stays readable.

22. **Unit and client tests.**
    Eleven unit cases cover exact runtime/startup mapping, three environments,
    security-policy host classifications, strict schemas, defensive copies,
    concurrent refresh/list and failure recovery. Two central-client cases verify
    narrow GET/POST, strict responses, secret-field rejection and controlled errors.
    Existing provider-registry and config tests also passed in focused validation.

23. **Integration tests.**
    Seven Fastify cases cover OS-assigned bound ports, identity, whole-data read-only
    behavior, actual app restart, defensive startup values, production/non-loopback
    state, strict bodies/queries/write rejection, origin/Host protection, content-free
    failure/recovery and simultaneous HTTP refresh coalescing.

24. **Browser tests.**
    Six Settings flows cover actual full-stack runtime/discovery refresh, production
    warning/Fake restriction, stale snapshot recovery, independent runtime Retry,
    provider Retry without invented statuses and disabled busy refresh. The normal
    sidebar navigation test now expects a real Settings page.

25. **Restart and ephemeral-port compatibility.**
    Reopening the same disposable DATA_DIR preserves effective Settings and private
    memory. A regression test starts a real server with port 0 and checks that
    Settings reports its allocated positive port. Existing shutdown fixtures stay
    unchanged; environment PORT validation continues to reject 0.

26. **Five consecutive focused runs.**
    Final source passed **20 tests in three files** in every run: 792 ms, 916 ms,
    687 ms, 1.38 s and 1.12 s. No test assertion, timeout or design tolerance was weakened.

27. **Full verification.**
    Format, lint, typecheck and build; **720 unit/integration tests in 68 files**;
    **101 E2E**, **46 design**, **2 release browser tests**; production smoke and
    five-cycle release smoke. Browser suites use isolated test ports/data and zero
    retries. Exact hosted results are tied to the pushed feature commit in the PR.

28. **Design and protected scope.**
    Desktop 1440px/mobile 390px captures were inspected in two bounded rounds;
    the first caught the fixed-header offset, corrected together before final
    capture. Single scoped detector: no findings. Fresh finish reviewer and
    read-only documenter: ship, no material fixes. Incumbent design files and
    pre-existing documentation drift remain untouched; no new raster assets.
    Agent Network, Automations, editable preferences, shared projects and billing
    remain outside scope. Actual registry/Kite memory and beta tag remain unchanged.

29. **Exact commands.**

    ```bash
    export PATH=/Users/gugloo/.nvm/versions/node/v22.23.2/bin:$PATH
    for run in 1 2 3 4 5; do
      npx vitest run tests/unit/settings.test.ts tests/unit/web-settings-api.test.ts tests/integration/server/settings-api.test.ts || exit 1
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

30. **Commit and GitHub handoff.**
    Feature commit: `feat(settings): add effective runtime settings and provider refresh`.
    The final delivery and PR record the exact pushed SHA and successful hosted CI
    URL. This report is inside that feature commit and cannot embed its own hash.
    The PR targets fresh main and remains open for review. No release tag or PR 22 work.
