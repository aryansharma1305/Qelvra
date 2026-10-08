# PR 21: Real Settings — configuration audit

Branch: `codex/pr21-real-settings`.
Fresh main baseline: `46066ce5eb61ffa38f675c126d0eb0f149a11f47`.
PR 20 / GitHub PR #3 was merged after both hosted CI jobs passed on
`add2a55271880c10feb67266413172a210abd126`.

## Existing sources

- `/settings` is an explicit EmptyStatePage entry in
  `apps/web/src/app/router.tsx`; there is no Settings service or persistence model.
- `apps/server/src/config/env.ts` validates effective startup configuration with
  Zod. It resolves server data and scratch-workspace roots, network host/port,
  allowed browser origins, logging, production mode, execution timeout and
  orchestration task/attempt/concurrency/timeout limits.
- `.env.example` documents those inputs. Changing the environment requires a
  server restart; changing a displayed value cannot reconfigure an existing service.
- Execution and orchestration consume configuration when `createApp` constructs
  them in `apps/server/src/app.ts`.
- GET `/api/health` provides real version, status and timestamp.
- GET `/api/providers` and the central `listProviders` client already expose
  validated provider availability, authentication and capabilities. ProviderRegistry
  caches discovery for 60 seconds and coalesces cached requests. Its internal
  `refresh()` clears that cache, but no explicit HTTP refresh route currently exists.
- Settings must use the central validated API client, strict shared schemas and
  existing AppError conventions rather than scattered fetch calls or raw environment dumps.

## Implementation boundaries

Separate effective runtime information from editable application preferences.
Each editable setting must have a real consumer, validation, documented precedence,
persistence and restart/apply semantics. Do not render a Save button whose values
are ignored or imply that startup-only configuration changes take effect live.

Reuse health and provider discovery rather than building another provider registry.
If explicit rediscovery is added, keep it bounded, test request coalescing, and
preserve the provider layer's secret-safe responses and production restrictions.
Authentication remains in the locally installed provider CLI.

Expose only deliberately selected configuration fields. Never return raw process
environment, API keys, provider credentials, command arguments, prompts, memory,
terminal output or workspace contents. No Settings action should silently relocate
existing workspaces or rewrite agent/task/goal state.

Preserve the existing Qelvra shell and show honest loading, error, Retry and
unavailable states. Any actual edit must have clear dirty/saving/saved/error behavior.
An effective-runtime field must be visibly read-only when its owner is startup config.

## Verification plan

Use disposable DATA_DIR and WORKSPACE_ROOT for every test. Cover strict requests
and responses, secret exclusion, real consumer behavior, persistence/restart,
failure recovery and unchanged unrelated data files. Add real browser flows and
desktop/mobile design coverage for the implemented Settings controls. Run the
existing static, unit, browser, design, production and release checks before opening
the implementation PR.

## Protected scope

Agent Network and Automations remain later PRs. No shared-project/worktree
collaboration, provider billing, hardware metrics, external tracking or beta tag
change belongs in PR 21. The kickoff audit does not change application behavior
or real user data. The merged Analytics implementation is the starting point.
