# ADR 0024: Shared Projects foundation

Date: 2026-10-13. Status: accepted for PR 24.

## Decision

Register existing local Git repositories in a separate version-1 ProjectRegistry.
Expose only persistent registration and explicit read-only inspection. This adds no
project relationship to agents, tasks, goals, automations or providers and never
changes their working directories. See the committed pre-implementation
[architecture/security plan](../plans/pr24-project-foundation.md).

`DATA_DIR/projects.json` stores up to 100 server UUID records in a 2 MiB snapshot,
using the existing atomic writer and exclusive server ownership. Names, canonical
paths, root/.git device/inode identity, UTC timestamps and the latest inspection
result are durable. GET is cached: only registration and explicit refresh inspect
Git. Unregister deletes metadata only. A missing/replaced/unsupported repository
remains registered with an unavailable status. Paths are immutable; relocation
requires unregister/re-register and yields a new project ID.

## Security boundary

This is single-user local software with the existing Host/origin checks and no API
authentication. Canonical paths are disclosed to that local client and the private
registry. They are not put into Activity, telemetry or inspection logs. File names,
contents, commit messages, remote URLs/config values and Git stderr are not exposed.

Supported: macOS/Linux, trusted server-installed Git 2.39+, ordinary SHA-1 format-0
repositories with passive configuration. Reject DATA_DIR overlap in either
direction, bare/nested repositories, selected symlink roots, linked worktree or
submodule `.git` files, commondir, alternates, format extensions, config includes,
filters and helper-bearing settings. Parent path aliases such as macOS /tmp are
canonicalized. Superprojects are inspected without entering submodule worktrees.
Hardlinked object stores (including some local clones) are conservatively unsupported.

Git receives fixed argv, no shell, a fresh allowlisted environment and a private
Git directory containing bounded no-follow snapshots of HEAD, index and local
refs plus an authored minimal config. Config preflight reads an immutable input
buffer with `--no-includes --file=-`; status never reopens the original config.
Hooks, filters, fsmonitor, global/system config, prompts, paging, optional locks,
transport, replacement refs and lazy fetching are disabled. No checkout, branch
creation, commit, fetch, clone, push, diff or generic execution API exists.

Validate the live object store against static symlink/hardlink redirection under
a bounded traversal. Validate tracked paths before status, rejecting symlink
ancestors; tracked symlink leaves are inspected as links. Tracked change counts
explicitly exclude untracked files and submodule worktrees. Dirty, detached and
unborn repositories are supported. Branches are limited to 200; packed refs may
be truncated honestly while excessive loose refs fail closed.

Limits: one globally admitted inspection, 5 seconds and 2 MiB combined output per
Git command, 45-second cooperative inspection deadline, 20,000 tracked index
entries, 8 MiB index, 1 MiB config/packed refs, 4 KiB HEAD/loose refs, 200 loose
refs, 16 namespace levels, 512 total ref entries/directories, 10,000 object-store
entries, four object directory levels and 256 MiB per object/pack file. Streaming
directory iteration stops at its limit. Unix command timeouts kill the process
group and await close before releasing admission. Shutdown blocks new admissions
and drains existing inspection while stopping automation admissions.

This is not an OS sandbox or a transactionally consistent filesystem snapshot.
A hostile same-user process can race filesystem validation, and Git parser bugs
or pathological objects may consume resources within the child-process bounds.
Only register repositories under the local user's control. No exactly-once or
cross-server repository collaboration promise is introduced.

## Restart and operator recovery

Startup validates the projects snapshot before existing registry recovery. Corrupt,
symlinked, hardlinked, over-limit or unsupported-version storage fails closed and
is not silently reset. Back up the stopped-server DATA_DIR before repairing or
restoring `projects.json`. Existing `.server-owner` recovery rules are unchanged;
never remove a live owner's claim. Do not use shared/cloud-synced DATA_DIR storage.

Inspection scratch snapshots are private under `DATA_DIR/project-inspections` and
normally deleted when inspection finishes. Crashes can leave scratch directories;
admission refuses at 100 leftovers. With every Qelvra server stopped and DATA_DIR
backed up, archive/remove only the generated `project-inspections/inspect-*`
directories. Never remove the registered repository or automation/agent stores.

Rollback to an earlier build ignores the additive project snapshot. There is no
bulk migration, repository write, task-origin change, dependency addition or beta
tag change. Worktree allocation and controlled integration need separate PRs.
