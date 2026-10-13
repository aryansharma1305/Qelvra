# PR 24 — Shared Projects Foundation

Status: architecture decisions accepted for the implementation scope supplied by the user.
Baseline: `f950e43627fcf99eccff49b47ecb859a2a9d65ab`.
Branch: `codex/pr24-project-foundation`. Date: 2026-10-13.

## Source audit and compatibility

AgentWorkspaceManager anchors agent workspaces to DATA_DIR/hive/agents and rejects
symlink/hard-link entry access. TaskRegistry owns assignment and human lifecycle;
AgentExecutionService gets cwd exclusively through ensureWorkspace, resolves local
provider availability/auth and supervises execution. OrchestrationService uses those
same tasks/executions. No caller may supply a project cwd. Those interfaces, persisted
agents/tasks/executions/goals/automations and existing PTY roots remain unchanged.

Every app claims DATA_DIR before startup validation/recovery. ProjectRegistry lives
behind that existing owner and uses the existing atomic write convention; no repository
lock or cross-server collaboration is introduced. Workspace-relative file utilities
cannot authorize external project paths: Projects requires its own validation interface.
The API remains single-user/local-only with existing Host/origin checks and no auth.

## Project identity and storage

A strict private version-1 `DATA_DIR/projects.json` retains at most 100 records and is
bounded on read. Each record has a server-generated project UUID, display name, canonical
absolute repository root, root/.git device+inode fingerprint, created/updated/inspected
UTC times and last validation/inspection result. No remotes, credentials, file names,
file contents, commit messages or execution output are persisted. No file is created
on an empty startup and no existing stores are rewritten.

Canonical paths deduplicate registration. Fingerprints detect replacement at a saved
path; they are local filesystem identity, not a globally stable Git identity. Paths
are immutable. Relocation requires explicit unregister and re-registration with a new
ID. Unregister removes only the Qelvra record; it never removes repository data.
Disappeared, changed, unsupported and failed repositories retain their record and a
controlled unavailable result until explicit refresh/unregister. Reads return the last
persisted inspection, labelled with its timestamp, and never launch Git.

## Supported paths and layouts

Accept existing absolute local directories on macOS/Linux with Git 2.39+, outside DATA_DIR, with a real `.git`
directory. Canonicalize parent aliases (including macOS /tmp and /var); reject a
symlink selection leaf and symlink Git metadata. Reject overlap in either direction
with DATA_DIR, nested repositories, bare repositories, `.git` files (linked worktrees
and submodule registrations), commondir/alternates and unsupported formats/extensions.
Superprojects can be registered when otherwise supported, but submodules are not
recursed into. Dirty tracked files, detached HEAD and an unborn branch are valid.

Revalidate root/.git fingerprints before and after each inspection. Copy only bounded
regular, singly linked HEAD/index/packed-refs/local branch-ref metadata with no-follow
reads into a fresh private Qelvra scratch Git directory. Reject unsafe metadata and
limit branch traversal depth/count. Reject static object-store descendant symlinks and
hardlinks with bounded traversal. Reject symlink ancestors of tracked paths before status;
tracked symlink leaves remain links. Do not run Git discovery in the selected repository.
Filesystem mutation by another local process can make an inspection inconsistent;
identity checks and controlled errors detect supported changes, not an atomic filesystem
snapshot. This is not a sandbox against a hostile same-user process or Git parser bugs.

## Read-only Git execution boundary

Git's own security documentation warns that untrusted .git configuration can execute
commands. Optional-lock suppression alone does not disable fsmonitor or clean filters.
Use a trusted Git executable found outside the selected repository, fixed argv and no
shell. Parse a bounded config snapshot via `git config --no-includes --file=-` from a
neutral cwd. Accept only selected passive standard-clone settings; reject includes,
filters, helper-bearing settings and unsupported extensions. Never pass repository
configuration, hooks, info attributes, replace refs or remote settings to inspection.
The inspection Git directory contains an authored minimal config and copied refs/index;
its object directory points only at the validated local object store. No original config
is reopened by status, eliminating the preflight/config-reopen helper-execution race.

Use a new explicit child environment, system/global configuration disabled, prompts,
pagers, optional locks, replacement refs and lazy fetching disabled; forbid all transport
protocols and disable fsmonitor/hooks/global attributes. Fixed commands inspect HEAD,
local branch refs and tracked-file porcelain status only. No log, diff, fetch, submodule
command, checkout, commit, push, arbitrary argument or shell endpoint exists.

Inspection reports tracked staged/unstaged counts, HEAD state and at most 200 local
branches. Untracked files and submodule worktrees are explicitly excluded; “tracked
files clean” must not claim the entire repository is clean. No path names or raw stderr
leave the inspector. Bounds: 5-second command timeout, 2-MiB combined command output,
8-MiB index, 1-MiB config/packed-ref inputs, 200 local loose refs, 16 levels of ref nesting
512 aggregate ref entries/directories, 10,000 object-store entries/four levels/256 MiB per
file, 20,000 tracked index entries, a 45-second cooperative deadline and one global
inspection at a time; excess is unavailable rather than an unbounded scan.
Temporary inspection metadata is deleted on completion; crash leftovers remain private
and bounded admission refuses further inspection when 100 leftovers require operator
cleanup. Shutdown drains the bounded admitted inspection before releasing DATA_DIR.

## API and UI contract

Strict POST /api/projects registers `{name,path}` after successful inspection; duplicate
paths fail without a second record. GET list/details reads persistent state; POST
`/:id/refresh` revalidates and persists actual available/unavailable metadata; DELETE
`/:id` unregisters metadata only. Unknown fields, relative paths, remote URLs, unsupported
IDs, selected Git args and oversized bodies fail validation. All responses are no-store.

`/projects` extends the existing Operate interface: native name/path registration form,
persisted project list, selected repository/HEAD/tracked counts/local branches and last
inspection timestamp. Explicit loading/error/empty/unavailable states; manual refresh,
unregister confirmation explaining that files stay intact, and desktop/mobile layout.
A Projects link from Files makes it discoverable without changing existing shell goldens.
Paths are visible only in the local Projects surface and private registry; no Activity
events, telemetry or logs contain paths/config/output. Existing non-loopback exposure
warning still applies; this does not make the API suitable for public hosting.

## Validation and rollout

Disposable repositories only: ordinary/dirty/detached/unborn, invalid and alias paths,
bare/nested/submodule/worktree layouts, metadata symlinks/hard links, malicious configs
and filters, Git failure/output/timeout bounds, disappearance/replacement, duplicate and
concurrent admission, atomic-write failures, restart persistence and API privacy/origins.
Hash repository files before/after inspection to prove no writes or helper side effects.
Browser registration/details/refresh/unregister/error/mobile and desktop/mobile captures.
Run complete format/lint/typecheck/unit/build/browser/design/release/production gates;
open implementation PR against main and verify hosted CI on the exact head.
Protect actual Kite/agent/task/automation state and the released beta tag. New project
storage is additive; rollback leaves the projects snapshot untouched and older builds
ignore it. Source security analysis is scoped to this foundation, not a whole-codebase
penetration test. No target-controlled malicious helper is intentionally executed.

## Explicit exclusions

No worktree allocation, branch creation/checkout, project agent cwd, shared execution,
merge/conflict resolution, remote clone, commits/pushes or repository mutations. PR 25
allocation and PR 26 controlled integration require separate architecture decisions.

## Primary references

- [Git security and execution environment](https://git-scm.com/docs/git#_security).
- [Repository layout and redirection](https://git-scm.com/docs/gitrepository-layout).
- [Configuration/includes/fsmonitor](https://git-scm.com/docs/git-config).
- [Status and background optional index refresh](https://git-scm.com/docs/git-status#_background_refresh).
- [Attributes and clean filters](https://git-scm.com/docs/gitattributes).
- [Bounded local reference enumeration](https://git-scm.com/docs/git-for-each-ref).
