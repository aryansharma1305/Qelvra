# ADR 0018: Agent workspace Files browser

Status: Accepted (v0.2 development)

## Boundary and existing ownership

The Files API selects a registered agent, then uses AgentWorkspaceManager's freshly
validated `DATA_DIR/hive/agents/<id>/workspace` root. DATA_DIR remains trusted server
configuration. No request selects a server root, cwd, metadata directory or another
agent's files. Agent deletion still preserves files; a deleted record cannot use
this API, and recreating the same ID reuses its preserved workspace.

Before implementation: existing workspace validation uses AgentIdSchema, lexical
containment, lstat, realpath, no-follow file descriptors and hard-link rejection.
Extend that manager's path resolver rather than introducing another root policy.
All user paths are slash-separated relative paths. Reject dot segments, empty
components, absolute/drive paths, backslashes, control bytes and encoded traversal.
Dotfiles and names with spaces are visible. Symlinks (including internal aliases),
hard-linked regular files and special files are displayed as unsupported and never
opened or mutated. Fixed parent validation is repeated for every operation.

These checks retain the trusted-local-user model. Node's portable filesystem APIs
cannot completely exclude a hostile local process replacing ancestor directories
between validation and a syscall. This is not an OS sandbox; no public/untrusted
network exposure is supported.

## Service and APIs

WorkspaceFileService owns listing, stat, UTF-8 reads, saves, exclusive creation,
mkdir, same-agent moves and bounded deletion. Routes only validate shared schemas.
All endpoints are under `/api/agents/:id/files`:

- GET `/`: directory listing (`path` defaults to root).
- GET `/content?path=...`: read text and its revision.
- GET `/entry?path=...`: metadata.
- PUT `/content`: save `{ path, content, revision }`.
- POST `/file`: exclusively create an empty file `{ path }`.
- POST `/directory`: create one directory `{ path }`; parent must already exist.
- POST `/move`: `{ from, to }`, same workspace, no overwrite.
- DELETE `/`: `{ path, recursive: false }`; root deletion is forbidden.

No absolute paths or raw filesystem diagnostics are returned. Service logging and
Activity carry only operation, agent ID, relative paths and controlled error codes.
Only successful user API mutations emit file.created/updated/renamed/deleted events;
no watchers emit content or provider-write noise.

## Content and resource bounds

Text editing supports valid UTF-8 without null/control binary bytes. Invalid UTF-8,
UTF-16 and binary data produce FILE_BINARY with no decoded content. Reads and writes
are limited to 1 MiB of UTF-8 bytes. Reads use bounded descriptor reads, including
when a file grows during inspection. Directory lists are lazy, capped at 2,000
entries and sorted directories first, case-insensitively with a stable tie-break.
Recursive deletion is explicitly confirmed in the UI and preflighted with at most
2,000 entries and 64 levels; unsafe descendants cause refusal before removal.

## Mutations and concurrency

All Files operations for an agent share a queue. Reads return a content/metadata
revision. Save requires that revision and rejects a changed file with
FILE_CHANGED_ON_DISK; there is no overwrite bypass. Saves write a private sibling
temporary file, fsync it, recheck the path and revision, then atomically rename it.
Failures before publication leave the old file intact and clean up our temporary
file. Existing file modes are respected and host permissions are never repaired
with chmod. Rename destination checks prevent API-level overwrites; filesystem
changes from external processes in the final check/syscall window remain a local
concurrency limitation, including saves and directory moves.

Creation uses O_EXCL/O_NOFOLLOW. File moves publish via an exclusive hard link then
remove the source; directory moves reserve an empty destination before rename.
Nonrecursive directory deletion refuses nonempty directories. Recursive deletion
uses explicit validated traversal, never a raw recursive rm of browser input.
Interrupted filesystem mutations are not a multi-file transaction.

## UI and scope

Files inherits the existing app shell, fonts, colors and controls. A real-agent
selector, lazy directory list and plain text editor provide breadcrumbs, Refresh,
metadata, create/rename/delete, save status and unsaved-change warnings. Unsupported
and large files remain read-only. Deep links contain only agent ID and relative
paths. API failures preserve edits; conflicts require an explicit reload.

Shared Projects, Git worktrees, merges, Memory, Analytics, Settings, Automations and
Agent Network are outside PR 18. The beta tag and release artifacts remain unchanged.
