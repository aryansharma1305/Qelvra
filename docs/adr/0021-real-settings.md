# ADR 0021: Effective runtime Settings and provider rediscovery

Status: Accepted (v0.2 development)

Settings displays selected validated startup configuration, runtime identity and
existing provider discovery. No editable preferences are introduced because the
current architecture has no settings persistence/consumer contract. There is no
Settings file, migration, environment editor, fake toggle or Save action.

GET `/api/settings` returns a strict, defensive startup snapshot: Qelvra version,
validated environment, server Node/platform/architecture, resolved storage roots,
configured API host/port, normalized allowed web origins, loopback-only state and
an explicit API authentication value of `not-enabled`. `restartRequired` is true.
ServerConfig retains the already validated NODE_ENV value to distinguish test,
development and production without rereading raw process environment.
Once listening, the port is the actual server-bound port. This also supports
existing test compositions that ask the OS to allocate an ephemeral port (0)
without weakening startup environment validation or returning a fictitious port.

Storage and network values are read-only. Users must change server startup
configuration and restart to apply changes. The workspace root serves developer
scratch shells; agents retain isolated managed workspaces. No data is relocated.
Non-loopback configuration visibly warns that the API has no authentication and
must not be exposed to untrusted networks. Origin/Host checks are not authentication.

Provider lists reuse GET `/api/providers`. POST `/api/providers/refresh` accepts
only an absent or empty object body and no query fields, clears the existing
registry cache and reruns bounded discovery. Concurrent refreshes share one
operation; callers receive defensive copies. Existing three-probe concurrency,
probe time/output limits, authentication detection and production Fake restrictions
remain in force. This action does not change provider configuration, authenticate,
launch an agent or execute a task. Unexpected failures return a content-free 503
PROVIDER_DETECTION_FAILED and release the coalescing slot for retry.

Strict shared response schemas and centralized clients validate both endpoints.
Responses never dump raw environment, credentials, probe output, executable paths,
arguments, prompts, memory, terminal data or workspace contents. Selected storage
paths are intentionally visible on this local administrative page. Existing local
origin/Host enforcement and no-store headers cover the new endpoints.

The UI loads runtime and provider data independently, with no polling. It has
honest loading, empty, initial error/Retry and last-known provider snapshot states.
Refresh is a real action, with a disabled busy control and semantic success/error
messages. Missing versions and unknown authentication are not invented values.

## Direction contract

THESIS: Make the running Qelvra installation inspectable, with no editable control
whose value the runtime ignores.

OWN-WORLD: Inherit the current dark Qelvra shell, Geist text, named mono tokens for
runtime data, restrained borders and lavender primary action. No visual-system change.

STORY: Inspect installation identity, check actual provider capabilities, refresh
discovery, then understand storage and network values and restart requirements.

FIRST VIEWPORT: Settings heading, read-only explanation, General key/value grid,
then Providers with its only action aligned to the section heading. On mobile,
values stack and provider rows stay readable within their container.

FORM: The user's four-section structure, rendered as semantic sections, definition
lists and a provider table. This fixed existing-world brief needs no concept seed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
For this ordinary extension, preserve existing design files and compare the build
with incumbent code. No new raster assets are shipped.
