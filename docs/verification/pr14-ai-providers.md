# PR 14 verification: safe AI CLI provider layer

Date: 2026-10-04. PR 14 establishes interactive provider admission and launching;
no task automation or PR 15 work is included.

## 1. Files created

- `apps/server/scripts/provider-smoke.ts`
- `apps/server/src/providers/index.ts`
- `apps/server/src/providers/provider-command.ts`
- `apps/server/src/providers/provider-detector.ts`
- `apps/server/src/providers/provider-environment.ts`
- `apps/server/src/providers/provider-errors.ts`
- `apps/server/src/providers/provider-probe.ts`
- `apps/server/src/providers/provider-registry.ts`
- `apps/server/src/providers/provider-types.ts`
- `apps/web/src/features/providers/useProviders.ts`
- `docs/adr/0014-ai-provider-layer.md`
- `docs/verification/pr14-ai-providers.md`
- `packages/shared/src/provider.ts`
- `tests/fixtures/provider-cli.mjs`
- `tests/integration/providers/provider-runtime.test.ts`
- `tests/unit/provider-detector.test.ts`
- `tests/unit/provider-registry.test.ts`

## 2. Files modified

- `README.md`
- `apps/server/package.json`
- `apps/server/src/activity/domain-events.ts`
- `apps/server/src/agents/agent-registry.ts`
- `apps/server/src/agents/agent-runtime-manager.ts`
- `apps/server/src/app.ts`
- `apps/server/src/pty/pty-manager.ts`
- `apps/server/src/pty/types.ts`
- `apps/server/src/routes/agents.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/agent-detail/AgentDetailPage.tsx`
- `apps/web/src/pages/agent-detail/AgentProfileHeader.tsx`
- `apps/web/src/pages/create-agent/AgentLivePreview.tsx`
- `apps/web/src/pages/create-agent/CreateAgentPage.tsx`
- `apps/web/src/pages/create-agent/StepIntelligence.tsx`
- `apps/web/src/pages/create-agent/WizardHeader.tsx`
- `apps/web/src/pages/create-agent/agentDraft.ts`
- `docs/architecture/frontend.md`
- `docs/architecture/overview.md`
- `packages/shared/src/activity-event.ts`
- `packages/shared/src/agent.ts`
- `packages/shared/src/api.ts`
- `packages/shared/src/index.ts`
- `tests/design/parity.spec.ts`
- `tests/e2e/agent-terminal.spec.ts`
- `tests/e2e/create-agent.spec.ts`
- `tests/integration/server/fake-agent.test.ts`
- `tests/integration/websocket/agent-terminal.test.ts`
- `tests/unit/agent-draft.test.ts`
- `tests/unit/web-agents-api.test.ts`

Deleted `apps/server/src/agents/runtime-command.ts`: fake no longer has a separate launcher.

## 3. ProviderRegistry API

`get(id)`, `list()`, `refresh()` and `resolve(agent, cwd, dataDir)`. Only server composition
can inject a detector/definition for fixtures. Each availability read returns a clone.
Unknown IDs fail before detection. The runtime owns lifecycle queues and delegates all
command selection to this registry. Discovery is lazy, not part of server startup.

## 4. Supported descriptors

Seven canonical IDs: shell, fake, ollama, codex, gemini, claude-code, opencode. Descriptors
include display name, kind and boolean interactive/local/requiresAuth/supportsWorkspace
capabilities. There are no model ratings, inference rates, token limits or prices.
Null remains an allowlisted shell; fake is opt-in and disabled in production.

## 5. Detection strategy

Walk absolute nonempty PATH entries for fixed names. Verify regular executable files,
reject unsafe names/relative paths/directories/nonexecutables, permit normal executable
symlinks, revalidate at launch. Fixed version/help probes must succeed with recognizable
output. Only a bounded numeric version is retained. Each probe is limited to three seconds
and 64 KiB combined output. POSIX probes own process groups and kill descendants on
exit/cancellation, including descendants that hold stdout open. Windows uses direct `.exe`
lookup and fixed system taskkill tree cancellation; Windows is not locally verified.

Cache TTL is 60 seconds; concurrent reads coalesce and at most three provider detections
run simultaneously. Missing/failing providers do not block the health API or startup.

## 6. Availability response

GET `/api/providers` returns `{ providers: [...] }`. For example, this machine reports:

```json
{
  "id": "codex",
  "name": "Codex",
  "kind": "cli",
  "available": true,
  "version": "0.160.0",
  "reason": null,
  "auth": "authenticated",
  "configured": true,
  "capabilities": {
    "interactive": true,
    "local": false,
    "requiresAuth": true,
    "supportsWorkspace": true
  }
}
```

Other reasons are CLI_NOT_FOUND, DETECTION_FAILED, AUTH_REQUIRED,
CONFIGURATION_REQUIRED and DISABLED_IN_PRODUCTION. Installed and configured are separate.
No paths, process output, account identifiers, configuration files or credentials appear.

## 7. Runtime command resolution

Provider-owned resolution returns `file`, fixed `args`, managed `cwd`, filtered `env` and
`inheritEnv: false`. AgentRuntimeManager hands this directly to PtyManager. Codex uses
locally verified `--no-daemon --sandbox workspace-write --ask-for-approval on-request`;
Claude uses its verified bare interactive invocation. No prompt or task is supplied.
Ollama is blocked until model selection is implemented. Other bare entry points are
architectural descriptors, not claims of locally verified interactive behavior.

## 8. Environment policy

Allowed: PATH, HOME, USER, LOGNAME, LANG, LC_ALL, LC_CTYPE, TERM, COLORTERM, TMPDIR, TMP,
TEMP, SystemRoot, WINDIR, USERPROFILE, APPDATA, LOCALAPPDATA, PATHEXT. Windows Path
normalizes to PATH. PTY terminal settings override terminal metadata. Only fake adds
server-owned QELVRA_AGENT_ID/QELVRA_DATA_DIR. API-key, loader/preload and unrelated
server variables are excluded. Crucially PtyManager replaces the parent environment;
the real fixture test poisons both its parent and detector environment to verify this.
The human scratch shell retains its previous environment policy.

## 9. Security guarantees and review

Creation accepts a known ID, never process configuration. Unknown process fields are
stripped; lifecycle payloads are ignored. Tests inject executable, command, argv, cwd and
environment through creation/start and confirm the fixed fixture executable/argv and
managed cwd are used. No sh/cmd interpolation, auth login, permission bypass, automatic
installation or model download is present. PATH is trusted server configuration.

Controlled PROVIDER_* errors sanitize spawn/probe details, settle failed starts to error
and leave no PTY. Registry activity admits only known provider IDs and safe error codes.
Dummy secret markers, native diagnostics and terminal output are absent from activity.
Provider/PTY failure logs contain codes/IDs rather than raw command output or environments.
This is workspace/command ownership, not an OS filesystem or network sandbox; provider
native security/configuration remains in force.

## 10. Authentication behavior

Locally inspected `codex login status --help` and `claude auth status --help` confirm the
read-only status commands. Detection retains only logged-in state (Codex's controlled
status phrase; Claude's boolean loggedIn and successful exit), discarding all account
fields. Missing authentication blocks start; unknown stays unknown. Provider-native
HOME/config/keychain login is used. Qelvra never logs in or scrapes credentials, and
custom provider configuration-directory/API-key environment variables are not forwarded.

## 11. UI integration

Create Agent renders API cards, numeric CLI versions and unavailable/auth/configuration
states; only launchable providers can be selected. The selected canonical ID is submitted
with name/role. Shell is the explicit safe default. Profile shows actual provider name
and availability; lifecycle errors are visible. No executable/argv/cwd/API-key field exists.
Mock model/context/temperature controls in the provider step are removed. The preview
marks the agent as a draft, removes fabricated readiness/VRAM/cost and zero-egress claims,
and explains the actual create-then-start flow. Other capabilities/directive draft controls
remain previews and are not submitted.

## 12. Fake migration

The fixed Node/tsx source child and bundled `dist/fake-agent.js` launch through the same
registry/resolver as real CLIs. The old runtime-command file is deleted. Production
creation rejects fake; discovery and existing persisted-fake startup are unavailable.
Nova → Atlas → Nova behavior, restart/backlog and shutdown remain verified.
An additional local smoke launches `dist/index.js` with temporary DATA_DIR, creates a
fake agent, attaches over WebSocket, observes READY/STATUS, verifies the workspace,
stops its process and shuts down the bundled server before deleting temporary data.

## 13. Test-provider strategy

A server-only known `codex` definition selects `tests/fixtures/provider-cli.mjs` with the
real Node executable. It reports cwd and environment-presence booleans, accepts terminal
input and starts a disposable child to verify tree cleanup. No external CLI or account is
required. Browser tests use the real dev fake provider through the same registry; descriptor
fixtures make unavailable UI and design surfaces deterministic without new masks.

## 14. Actual local provider matrix and smoke

| Provider    | Detection on this machine                           | Interactive verification                                                                              | Required in CI              |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| Fake        | Available in development/test; production disabled  | Real mailbox/PTY and browser regressions; local bundled startup/stop smoke                            | Yes, source tests and build |
| Shell       | Allowlisted local shell available                   | Start/attach/input/resize/stop/restart regressions                                                    | Yes, system shell           |
| Codex       | 0.160.0; authenticated                              | Passed temporary-workspace PTY and real browser terminal smoke; two tracked processes gone after stop | No                          |
| Claude Code | 2.1.287; authenticated                              | Help/version/auth inspected; interactive startup not smoke-tested                                     | No                          |
| Gemini CLI  | Missing                                             | Unverified; unavailable                                                                               | No                          |
| Ollama      | 0.21.2 installed; model selection not configured    | Not launched; no model/daemon downloaded/started                                                      | No                          |
| OpenCode    | Executable found; OS terminates version/help probes | Unverified; DETECTION_FAILED                                                                          | No                          |

Codex smoke creates only a disposable Agent in temporary DATA_DIR, verifies the realpath
of `hive/agents/provider-smoke/workspace`, observes native startup, stops and verifies
parent/child cleanup, then removes data. A separate temporary API/web instance exercised
profile Start → Open Terminal → real Codex output → Stop in the browser. No prompt,
trust confirmation, model request or assigned task was sent. Kite's name, role, provider,
status and timestamps are unchanged.

## 15. Unit tests

Provider detector/registry tests cover installed/missing executables, safe PATH/file checks,
timeout, nonzero/malformed output, bounded output, child-held pipes, unknown IDs,
cache/coalescing/expiry/refresh, bounded concurrency, production fake, auth states,
Ollama configuration, owned commands, sanitized environments and launch revalidation.
Two API-client tests also cover provider submission filtering and discovery validation.

## 16. Integration tests

Five actual provider API/PTY tests: fixture output/cwd/input/resize/child stop/restart;
canonical cached path-free discovery; unavailable metadata/start and activity error;
sanitized native launch failure; unknown-ID rejection. Parent environment replacement
is checked against a deliberately poisoned PTY parent environment.

## 17. Fake-agent regressions

19 tests in three files cover fake behavior, actual multi-agent exchange and server shutdown.
The existing three-agent test now asserts a single retried full envelope snapshot rather
than racing two reads against the router's hard-link unlink/ctime change. No mailbox
validation or cleanup guarantee was weakened. Shell integration explicitly composes
its clean system-shell provider through the new registry rather than overriding only PTY.

## 18. Browser tests

69/69 in Chromium with one worker and zero retries. API-derived cards are counted;
a deterministic missing Gemini card is disabled; fake is selected in the wizard, persisted,
started from profile, attached in the browser terminal, observed and stopped with its PID
gone. Existing fake round trips and shell terminal actions remain green. Real Codex browser
smoke is separate and local-only, never a CI requirement.

## 19. Design parity and visual review

42/42 at 1280, 1440 and 1920 widths. No tolerance increase or new mask. Deterministic
provider descriptors and exact intentional copy edits preserve the incumbent frames.
The original Google aida brand/profile URLs expired; reference captures now use the exact
artwork already retained in the repository by ADR 0002. Initial failures were broken
reference images, not accepted UI drift. Provider interception is applied only to app capture.
Reference typography also uses ADR 0002's exact retained font files, avoiding remote
font loading and version drift; font families, weights and layout remain unchanged.
Desktop provider cards were inspected; the UI detector reports no findings. The inherited
fixed 224px sidebar leaves the wizard too narrow on phone widths; general mobile shell
adaptation is outside this provider milestone and is not claimed as complete.

## 20. Repeated runs

The final focused provider suite (39 tests, three files) passes five consecutive times.
The fake-agent regression suite (19 tests, three files) passes five consecutive times.
Full runs also exercise both suites. Repetitions use disposable data and cleanup assertions.

## 21. Full verification

531/531 unit/integration tests across 43 files; formatting, lint, typecheck and production
build pass. Browser and design results are above. Real CLI smoke is local-only. No test
provider PTY or tracked child remains; temporary smoke data is removed. E2E/design use
the isolated `.qelvra-e2e` directory, which is removed after shutdown. Localhost remains
available on 5173/3001 with the existing Kite and no demo agents/tasks seeded there.

## 22. GitHub CI

CI runs format, lint, typecheck, unit/integration, build and browser jobs on Ubuntu/Node 22.
It neither installs nor requires any third-party AI CLI. Mocks and the Node/system-shell
fixtures prove admission and launching. The final handoff records the actual pushed SHA,
verified GitHub run URL and job conclusions after push; a local result alone is not treated
as remote CI success. Design and authenticated native-provider smoke remain local checks.

## 23. Known limitations

No orchestration, task auto-execution, provider billing/accounts, secret vault, arbitrary
commands, CLI installation, model downloads, Ollama model selection or advanced Settings.
Availability is a cached installation/launch-admission snapshot, not model-service health
or proof that an authenticated provider can complete a paid request. Native provider config
may require additional setup. Windows/cmd wrappers and uninstalled/broken CLI interactive
syntax are not advertised as locally verified. Existing non-provider design mock surfaces
and the desktop app-shell constraint remain documented.

## 24. Exact verification commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
for run in 1 2 3 4 5; do
  npx vitest run tests/unit/provider-detector.test.ts tests/unit/provider-registry.test.ts tests/integration/providers/provider-runtime.test.ts || exit 1
done
for run in 1 2 3 4 5; do
  npx vitest run tests/unit/fake-agent.test.ts tests/integration/server/fake-agent.test.ts tests/integration/server/fake-agent-shutdown.test.ts || exit 1
done
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
npm run provider:smoke -w @qelvra/server -- codex
```

For the local browser check: run `npm run provider:smoke -w @qelvra/server -- codex
--browser` (two-minute bounded temporary API on 3115); in another terminal run
`VITE_API_URL=http://127.0.0.1:3115 npm run dev -w @qelvra/web -- --port 5188`.
Open `/agents/provider-smoke`, Start, Open Terminal and observe native startup without
submitting a prompt/trust confirmation. Return to profile and Stop. Stop the temporary
web server; the smoke API verifies cleanup and removes its temporary directory.
Normal user preview is `npm run dev`, http://127.0.0.1:5173/agents/new?step=2.

## 25. Commit SHA

The immutable pushed SHA is supplied in the final handoff with its verified CI link.
`git rev-parse HEAD` identifies the checked-out release. Keeping the SHA out of its own
commit content avoids a self-referential commit hash.

## 26. Commit message

`feat(providers): add safe AI CLI provider layer`
