# PR17 release-hardening verification

Candidate: 0.1.0-beta.1. Baseline: d3bd9c5bf019b1e5d96ae3092459b12c19034fc5.
Recommendation: DO NOT SHIP. Owner-approved license is an unresolved P0; no tag/release is authorized while it remains. Validation is in progress; pending entries below are not passing claims.

## Requested 30-item report

1. **Release audit:** performed before implementation; see ../release/pr17-audit.md. Covers UI, stores, runtime, processes, transport, trust boundaries, docs, CI and build output.
2. **P0/P1:** P0 license, HTTP foreign-origin/Host gap, misleading metrics/security claims. P1 startup preflight, quarantine growth, route errors, in-place retry, stale connectivity, docs/gates, accessibility; verification found retained-owner watchers and publication/read ctime race. License remains unresolved; other fixes are implemented and under final validation.
3. **Created files:** release HTTP/startup services and regression tests; production/five-run/soak scripts; release browser/load tests/config; PreviewNotice/RouteError; beta reference copy manifest; docs, env and release workflow/guard. Exact paths: [file inventory](pr17-file-inventory.md).
4. **Modified files:** shell and existing page families, provider retry/presentation, registry schemas exported for preflight, lifecycle schema validation, router cleanup, mailbox read safety, privacy logging, package versions/lock/configs/CI and existing tests. Original Stitch exports and assets remain intact.
5. **Mock/dead UI:** no invented CPU/context/productivity/timing/enclave enforcement; retained visual cards labeled Coming later/Not measured, inert actions disabled with explanation. Home Create Goal transfers a draft to the existing explicit goal workflow; preview profile links return to real agents.
6. **Provider onboarding:** installation/auth/config states and short provider-owned setup guidance, no executable paths in UI, in-place Retry preserves drafts. Only Codex has real automation; fake is development-only; others are interactive/detection only as documented. Ollama model selection is unavailable.
7. **Startup/recovery:** writable real-directory probes, all authoritative snapshots validated before any recovery rewrite, specific subsystem/file error and non-overwrite assurance. Activity retains recoverable corrupt-line diagnostics. Existing version-1 formats retained.
8. **Shutdown/process cleanup:** existing signal hooks, watchdog, execution/router/activity/PTY cleanup; fixed deleted-owner watchers; full crash/signal tests, repeated flows, final process scan pending.
9. **Security audit:** focused source-boundary review, not certification. HTTP exact origin and loopback Host enforcement before mutation, framing/nosniff/referrer/cache headers. Existing schema, traversal/symlink, changed-file, correlation, WS frame/size/binary/disconnect tests retained. No browser-supplied launch commands/args/cwd accepted. Cwd is not an OS sandbox.
10. **Secret/log audit:** routine request URL/header logging disabled; origin rejects log controlled codes; activity schemas store no terminal/message payloads or credentials. Provider login stays provider-owned. Existing content/path redaction tests retained. Local execution logs can contain provider output and need private backup handling.
11. **Accessibility:** focus-visible, labels, truthful disabled hints, actual lifecycle labels, reduced motion and smaller-width header/card adjustments. Existing keyboard/modal Escape behavior retained. Fresh reviewer scored its one Home sample-truth finding resolved. Documenter confirmed the ordinary extension preserves the incumbent tokens, theme, artwork and export; pre-existing DESIGN.md prose/token drift remains untouched. No WCAG certification claim.
12. **Production:** built server NODE_ENV=production starts with empty data, fake rejected before creation, no fixture/debug routes, origin/secure headers, built web assets checked; web source maps absent, server maps remain local and are not HTTP-served. Final rebuild and production smoke pass. Built web 2.73 MiB / built server 1.00 MiB on disk; main JS 436.75 kB (133.77 kB gzip), lazy Terminal chunk 367.53 kB (91.43 kB gzip).
13. **Fresh clone:** pending final candidate clean clone with no node_modules/.qelvra/dist, README npm ci/build/test/dev.
14. **Docs:** README, docs/providers.md, docs/architecture.md, docs/limitations.md, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md, release notes/checklist/audit and this verification report. Backup entire stopped-server DATA_DIR, including hive and all snapshots/logs; do not reset corrupt state.
15. **Version:** all four packages and health endpoint 0.1.0-beta.1; supported Node22 enforced with engines, .nvmrc and engine-strict.
16. **Release workflow:** tag v0.1.0-beta.1 reruns full CI, then requires owner-approved LICENSE and SHIP checklist; creates source-run GitHub prerelease only. No npm publishing, deployment or desktop packaging. Not triggered.
17. **Unit/integration:** 630/630 tests across 56 files pass on the final application code. No timeout increase or retry was used.
18. **Browser:** release flow + load case pass (2/2); existing 75 zero-retry final run pending.
19. **Design:** final 42/42 pending. Original exports, 300-pixel mismatch budget and existing dynamic masks preserved. Approved beta truth copy is explicitly mapped before reference capture; only intended copy/empty bar/preview notice/disabled egress changes are adapted. No golden refresh or widened tolerance.
20. **Five-run:** five consecutive current-code core flows pass in 32 seconds, including five complete startup/shutdown cycles, lifecycle, routing, tasks and goals. Each idle checkpoint reports zero executions/PTYS; final shutdown leaves only a transient CloseReq.
21. **Soak:** earlier watcher leak and a 46-cycle mailbox ctime failure are recorded as failed, not counted. Final post-fix real 30-minute soak running. No simulated clock/shortened duration.
22. **Real Codex:** local-only real Codex 0.160.0 task and Codex-orchestrator/fake-workers smokes pass. Exact 12-byte HELLO_QELVRA artifact, structured result and manual review verified; two planned tasks did not materialize before approval, then completed with reviewed artifacts/final summary. Zero execution processes/PTYS; repository fingerprints unchanged and disposable directories removed. Never required by CI.
23. **Limits:** isolated workspaces, no automatic merge/shared repo, at-least-once edge cases, provider-installed/authenticated local tooling, single trusted local user, file storage, desktop-first, Windows unverified, source-run only. Activity disk cap 32 MiB / memory 10k; quarantine 1k per agent; owner manages workspace/preserved history growth.
24. **Checklist:** ../release/v0.1-beta-checklist.md uses PASS/FAIL/DEFERRED. License P0 remains FAIL.
25. **Commands:** exact commands below; failed/partial attempts are described separately.
26. **Commit SHA:** candidate commit and exact final HEAD will be recorded after commit/push; final response reports exact HEAD, avoiding a self-referential documentation hash.
27. **GitHub CI:** exact final HEAD result pending; no older green run is substituted.
28. **Recommendation:** DO NOT SHIP; PR17 incomplete until owner license decision and all remaining gates pass.
29. **Suggested tag:** v0.1.0-beta.1 only after all P0 gates clear. No tag created.
30. **Suggested commit message:** chore(release): harden Qelvra for v0.1 beta.

## Exact validation commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
npm run test:release -- --workers=1 --retries=0
npm run production:smoke
npm run release:smoke
npm run release:soak -w @qelvra/server
npm run execution:smoke -w @qelvra/server -- codex
npm run orchestration:smoke -w @qelvra/server -- codex
node scripts/check-release.mjs
```

The last command must fail while the owner license/SHIP decision is unresolved. It is a publication gate, not a unit test failure. Native smokes use locally authenticated Codex and may incur provider usage. All destructive test data is disposable; Kite stays in the developer DATA_DIR.

## Performance observations

Disposable public-API dataset: 100 agents, 500 tasks, 1,651 real events, 50 draft goals. Search, task inspection/Escape, goal selection and Activity rendering passed without page errors. Cold local runs with concurrent verification: startup 398–1,954 ms; provider detection 840–2,021 ms; full agent/task/goal listings 2–5 ms; paginating all events 331–898 ms; initial Agents page 958–1,229 ms. These are rough wall-clock baselines, not performance guarantees or CI time thresholds. Production bundle sizes and soak resource observations will be added after final checks.
