# ADR 0014: server-owned AI CLI providers

Status: accepted. Date: 2026-10-04.

## Context

Before PR 14, AgentRuntimeManager obtained the managed workspace and called
`resolveRuntimeCommand`: null delegated to PtyManager's local shell; `fake` selected
one fixed Node child. All other provider IDs failed. PtyManager merged the entire
server environment with command overrides. The wizard's provider cards were mock
model names and its submission omitted provider selection.

## Decision

A canonical shared contract defines `shell`, `fake`, `ollama`, `codex`, `gemini`,
`claude-code` and `opencode`. Agent metadata stores only the ID. New metadata must
use a known ID; known unavailable providers are accepted by the backend so configuration
survives a temporarily missing installation. Historical string IDs remain readable
and fail with PROVIDER_NOT_FOUND on start. Null continues to mean the local shell.
The wizard explicitly defaults to shell; fake is opt-in and development/test only.

```text
Agent (providerId)
  ↓
AgentRuntimeManager → AgentWorkspaceManager (validated managed cwd)
  ↓
ProviderRegistry (availability, cache, admission)
  ↓
ProviderCommandResolver (server executable, argv, cwd, filtered env)
  ↓
PtyManager (one agent PTY, attachment/I/O/resize, process-tree stop)
  ↓
Shell / Fake / Codex / Claude Code / Gemini / OpenCode
Ollama admission stops at CONFIGURATION_REQUIRED until model selection exists.
```

`ProviderRegistry.get(id)`, `list()`, `refresh()` and `resolve(agent, cwd, dataDir)`
are the server API. GET `/api/providers` returns descriptors and availability;
there is no browser refresh/command/config endpoint. Detection is lazy, cached for
60 seconds, coalesced per ID and limited to three concurrent provider detections.
Each fixed version/help/auth process has a three-second timeout and 64 KiB output
bound. Detection never runs during server startup. Failures are isolated and emit
only a controlled provider ID/error-code warning.

Executable lookup walks nonempty absolute PATH directories. Candidate names come
from definitions, not request input. Directories, relative executable paths, NULs
and nonexecutable files fail validation. Windows accepts direct `.exe` programs;
`.cmd`/`.bat` shell wrappers are deliberately unsupported. Symlinks to regular
executable files are supported for normal package installations. Launch revalidates
the executable. PATH and its directories are trusted server configuration; this is
not protection against a hostile local administrator replacing a CLI during spawn.

Version and help are fixed arguments, run with direct `spawn`, never shell interpolation. Probes own detached POSIX process groups;
timeout/output-limit cancellation kills descendants and closes held pipes. Windows uses
the fixed system taskkill executable for tree cancellation (not locally verified).
Only a numeric version (maximum 64 characters), controlled reason and authentication
state cross the HTTP boundary. No executable paths or raw probe output are returned.
Runtime arguments are server-owned; POST create strips process settings, and lifecycle
routes ignore bodies. Workspace resolution remains owned by AgentWorkspaceManager
and PtyManager rechecks containment before spawning.

## Launch and authentication policy

- Shell: existing allowlisted local shell selection, non-login agent launch. The
  developer scratch terminal retains its existing configured shell behavior.
- Fake: the same registry/resolver launches the fixed Node CLI, via tsx in source and
  `dist/fake-agent.js` in a bundle. Production creation and launch are disabled.
- Codex: local 0.160.0 help verified `--no-daemon --sandbox workspace-write
--ask-for-approval on-request`. The no-daemon flag avoids an untracked shared
  server, and these arguments retain native approval/sandbox controls. Versions
  lacking these required help flags fail detection rather than guessing a fallback.
- Claude Code: local 2.1.287 help confirms bare `claude` opens an interactive session.
  Native authentication/permissions stay in force. No bypass or prompt arguments.
- Gemini/OpenCode: fixed bare interactive entry points, version/help detection;
  interactive behavior is unverified on this machine (Gemini missing; OpenCode probes
  are terminated by the OS). They are not advertised as locally verified runtimes.
- Ollama: local 0.21.2 `run` requires a model. Installed CLI is distinct from model
  configuration. `available: true`, `configured: false`, CONFIGURATION_REQUIRED;
  no default model, daemon launch or model download is selected.

Safe read-only authentication probes are `codex login status` and
`claude auth status --json`, verified against installed command help. Only logged-in
state is retained; email, credentials and raw text are discarded. Unknown auth
remains unknown; definite missing auth blocks start. Other CLIs handle their own
setup interactively. No login is initiated. Credentials/config may be read by the
provider itself under HOME; Qelvra does not open or scrape these files.

## Environment

Every agent provider command sets `inheritEnv: false`; PtyManager passes this
replacement environment rather than merging its parent environment. Allowed keys:

`PATH HOME USER LOGNAME LANG LC_ALL LC_CTYPE TERM COLORTERM TMPDIR TMP TEMP
SystemRoot WINDIR USERPROFILE APPDATA LOCALAPPDATA PATHEXT`.

Windows `Path` normalizes to PATH. TERM/COLORTERM are set for the managed PTY.
Only fake additionally receives the server-owned QELVRA_AGENT_ID/QELVRA_DATA_DIR.
No provider receives API-key variables, NODE_OPTIONS, preload variables, Qelvra
server configuration, or unrelated credentials. Custom provider config-directory
variables are intentionally not forwarded in this milestone. Provider-native config
and login may still supply credentials; environment filtering is not an OS sandbox.
Agent cwd separation does not prohibit a CLI from accessing files allowed by its
native permission policy. The existing human developer scratch shell is outside
agent-provider admission and retains its prior environment behavior.

## Failure and UI behavior

Provider errors are NOT_FOUND, UNAVAILABLE, EXECUTABLE_NOT_FOUND, DETECTION_FAILED,
AUTH_REQUIRED, CONFIGURATION_REQUIRED and LAUNCH_FAILED (all prefixed PROVIDER_).
They become controlled HTTP errors, never raw process diagnostics. An attempted
failed start settles the agent to error and creates no managed runtime. A PTY spawn
failure is sanitized; existing shell spawn errors retain AGENT_START_FAILED.
Committed activity includes a known providerId and safe errorCode. Output, command
environment and auth probe contents never enter activity or error logs.

The wizard renders API descriptors, versions and honest states, disables providers
that cannot launch, and submits providerId only. Profile shows real provider name/
status. Lifecycle controls still submit no body and show the controlled start error
when availability changes. Unsupported model/context controls in the provider step
were removed; other wizard steps remain design previews and are not submitted.

## Verification and consequences

CI uses mocked process probes and a server-injected known-ID definition pointing to
a disposable Node fixture. It exercises the same registry → resolver → PTY path,
including child cleanup, filtered environment and browser-input rejection. Browser
coverage selects fake through real discovery and checks UI → API → actual PTY.
Design tests use deterministic descriptor fixtures and exact intentional copy edits,
with no new masks. Real installed-provider checks are local-only, run in temporary
DATA_DIR and send no model prompt. See the PR 14 verification report for the matrix,
commands and results.

No task auto-execution, orchestrator intelligence, billing, secret vault, configuration
writer, CLI installation or model downloading is introduced. These require separate
product contracts; PR 15 is not started here.
