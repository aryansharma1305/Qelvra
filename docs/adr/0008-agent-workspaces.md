# ADR 0008: Per-agent filesystem workspaces

Status: Accepted

## Ownership and layout

`AgentRegistry` owns identity, status and JSON persistence. `AgentWorkspaceManager`
owns filesystem initialization and validation. `AgentRuntimeManager` coordinates
creation and lifecycle operations; `PtyManager` remains a generic shell host.

```text
DATA_DIR/
  agents.json
  hive/agents/<agent-id>/
    inbox/
    outbox/
    workspace/
    agent.md
    memory.md
```

`DATA_DIR` is trusted server configuration. The browser supplies only agent identity
and display metadata; request fields such as cwd, path, command and env are ignored.
The directory card and detail drawer display the deterministic relative path
`hive/agents/<id>/workspace`. No absolute path is needed for that display and no
filesystem endpoint, file explorer or workspace deletion UI is introduced.
Terminal session metadata continues to report cwd as before.

## Manager API

- `AgentWorkspaceManager.open(dataDir, logger?)`: prepare and validate fixed parents.
- `ensureWorkspace({ id, name, role })`: create missing pieces and return validated cwd.
- `getWorkspacePath(id)`: validate existing parents and cwd, then return canonical cwd.
- `exists(id)`: false only for missing paths; unsafe entries/errors are surfaced.
- `relativePath(id)`: validate identity and return a relative display path.
- `readMetadata(id, "agent.md" | "memory.md")`: internal fixed-file reads only.

There is intentionally no recursive deletion method. Deleting filesystem data needs
an explicit future policy; metadata deletion never invokes filesystem deletion.

## Path safety

The shared `AgentIdSchema` restricts IDs to 1–64 lowercase letters, digits and inner
hyphens. This rejects separators, dot segments, absolute paths, percent-encoded
traversal and null bytes without decoding paths. Windows device IDs are additionally
refused by the workspace manager. Generated paths use only the canonical DATA_DIR,
fixed server segments and the validated ID. Lexical containment is checked with
`path.relative`; existing paths are checked using `lstat` and `realpath`.

All managed fixed parents, agent roots, standard directories and metadata leaves
must have the expected type. Symlinks are refused even when their target is within
the hive, avoiding aliases between agents. Metadata hard links are refused too.
Exclusive file creation uses `O_EXCL` and `O_NOFOLLOW`; safe metadata reads use
`O_NOFOLLOW` and validate the opened descriptor. The manager checks paths again on
each ensure/start/read; it does not cache a previously safe cwd.

New directories use mode 0700 and metadata files 0600, subject to umask and platform
support. Existing modes and files are preserved; there is no ACL management.

These checks constrain server operations; shells still run as the server OS user.
Relative cwd isolation is not an OS sandbox: an agent can intentionally use absolute
paths or `..` to reach other files allowed by that user. A concurrently hostile local
process with the same OS permissions can rename parent directories between path
checks and operations; complete race resistance would require descriptor-relative
platform primitives or OS isolation. PR 8 does not claim either capability.

## Creation transaction and rollback

REST creation goes through `AgentRuntimeManager.create`, on the same per-agent queue
used by start/stop/restart/delete:

1. Validate input and determine the ID.
2. Persist registry creation (duplicates and persistence failures create no workspace).
3. Ensure the filesystem layout.
4. Return success only after both succeed.
5. On filesystem failure, remove newly created pieces, then roll back registry creation.

The workspace manager journals only the pieces it created, checks their inode/device
identity during rollback, unlinks only its new files and uses nonrecursive `rmdir`.
Existing content is never deleted. A partial repair on a preserved root is undone
without affecting old content. Per-ID ensure queues make concurrent initialization
predictable without global locks. Lifecycle queues prevent start/delete from observing
an in-progress REST creation. Direct registry creation is an internal metadata-only
operation; production callers use the runtime coordinator.

JSON and filesystem writes are not one atomic transaction. If compensation itself
fails (for example continued disk failure), an aggregate error and structured log
surface both failures; the API cannot claim success. No unsafe recursive cleanup is
attempted. Startup initialization repairs missing pieces where possible or refuses
startup. A crash between steps can leave metadata needing initialization on startup.
Exclusive initial writes are not a transactional filesystem journal: a process crash
during a write can leave an incomplete initial file, which is preserved for inspection
rather than overwritten automatically.

## Initialization, migration and file policy

Startup ensures every legacy registry agent's layout before exposing routes or
creating processes. Failure logs the agent ID and refuses startup; metadata remains.
Nothing starts automatically. Starting/restarting an agent ensures its layout again
and supplies its validated `workspace/` cwd to `PtyManager.createSession({ cwd })`.
A validation failure uses the existing agent-start failure/status handling, with no PTY.

`agent.md` is generated on first creation and subsequently user-editable. Name/role
changes or recreation do not overwrite it. `memory.md` starts with a minimal heading
and has no automatic updates or summarization. Repeated ensures create missing pieces
only, preserving workspace code, memory, directives and inbox/outbox content.

Metadata deletion stops the runtime first and preserves the whole workspace. Reusing
an ID reattaches to that preserved data, including custom `agent.md`. These directories
may therefore outlive registry records intentionally; cleanup is an owner's separate
explicit action. Inbox/outbox are empty preparation for later PRs; no routing,
watchers, message schema, task assignment, orchestrator or AI provider behavior exists.

## PTY configuration

Scratch/developer sessions retain `WORKSPACE_ROOT` as their default cwd. The server
also configures `PtyManager.additionalWorkspaceRoots` with the canonical agents root,
so DATA_DIR can be outside WORKSPACE_ROOT. These roots are server-only configuration;
PtyManager resolves cwd and verifies containment without knowing the hive layout.
Injected test PTY managers must admit their temporary agent workspace root as well.

## Verification

Unit coverage exercises exact layout, permissions, idempotence, concurrent ensure,
repair, preserved content, invalid IDs, fixed-parent/agent/subdirectory/metadata
symlinks, hard links, filesystem failure and rollback. Integration coverage verifies
REST creation, persistence failure, migration, creation/lifecycle ordering,
delete/recreate and real shell pwd/file isolation/persistence. Browser coverage uses
the terminal for pwd, marker creation, cross-agent absence, restart and reattachment.
No browser filesystem shortcuts or new design masks are used.

Final commands and measured results are recorded in
[PR 8 verification](../verification/pr8-agent-workspaces.md).
