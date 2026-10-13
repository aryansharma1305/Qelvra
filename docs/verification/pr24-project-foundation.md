# PR 24 — Shared Projects foundation verification

Date: 2026-10-13. Baseline: `f950e43627fcf99eccff49b47ecb859a2a9d65ab`.
Branch: `codex/pr24-project-foundation`.

## Scope and decisions

The required architecture/security plan was committed first as `07d890d`, before
implementation. [Plan](../plans/pr24-project-foundation.md) and
[ADR 0024](../adr/0024-project-foundation.md) record the independent registry,
canonical local identity, read-only Git boundary, bounded work and restart policy.
No project cwd enters existing agent workspace, task, goal, automation, execution,
provider or PTY interfaces. No repository mutation, worktree allocation, branch
creation/checkout, clone, commits, pushes, shared execution or integration is added.

## Evidence

- Disposable repositories report actual branch/commit, staged and unstaged tracked
  changes, detached/unborn states and bounded packed local branch names.
- Repository snapshots compare file bytes and mtimes before/after inspection,
  duplicate registration, refresh and unregister. No repository files change.
- Unsafe config (includes, filters, fsmonitor, hooks, extensions, ssh/cwd helpers),
  inherited Git environment, invalid/remote/missing paths, selected symlinks,
  linked Git files, nested/bare/DATA_DIR-overlapping layouts, hardlinked/symlinked
  metadata and redirected object stores fail closed without helper execution.
- Corrupt/oversized index, malformed HEAD, absent/old Git, stdout overflow,
  timeout/process-group termination and overlapping admission are covered.
  Aggregate empty ref directories are bounded, not just branch files.
- Stable IDs/cache survive restart; missing/replaced repositories persist an
  unavailable outcome. GET does not inspect. Unregister removes only metadata.
  Failed atomic writes do not publish new memory state; corrupt storage is preserved.
- Strict API body/query/ID validation refuses commands/options and preserves
  Host/origin protections. Existing disposable agent/task/memory/Activity files
  remain unchanged through registration; no private prompt/content/config/output
  appears in project responses or Activity. A second DATA_DIR owner is rejected.
- Browser tests cover the Files entry link, registration, real details, dirty
  refresh, cached reload, unregister/cancel, missing-path error and recovery,
  unavailable persistence, loading/retry and unknown selection. Full desktop/
  mobile design checks assert wrapping, no document overflow, width, existing
  action color and native keyboard focus.

## Verification gates

All tests use disposable state; no paid provider execution is required.

| Gate                             | Result                       |
| -------------------------------- | ---------------------------- |
| Focused project unit/integration | 36 tests / 2 files passed    |
| Format, lint, typecheck          | Passed                       |
| Complete unit/integration        | 826 tests / 76 files passed  |
| Build                            | Passed                       |
| Complete browser                 | 120 tests passed             |
| Complete design                  | Pending final complete gate  |
| Release browser                  | Pending final complete gate  |
| Production distribution smoke    | Passed                       |
| Release lifecycle smoke          | Passed 5 cycles / 29 seconds |

Local gate logs are `/tmp/qelvra-pr24-*.log`; captures under
`.impeccable/review/projects/` are ignored verification evidence. The detector ran
once and returned no findings. Fresh interface review returned **ship**; the
[documentation comparison](../design/pr24-projects.md) preserves the incumbent
system and records existing documentation/token drift. Its local undefined title
utilities were replaced with defined body-size/weight utilities.

Focused source security review identified missing aggregate ref-directory bounds
and object-store descendant redirection checks. Both were corrected and regression
tested; the reviewer verified those two fixes resolved. A final selected-path
regression also checks physical parent traversal before canonicalization, including
symlinked parents with `..`, trailing slashes and final-dot selection. Source review
confirmed that correction as well. This is a scoped source
review, not a whole-codebase penetration test or OS sandbox certification.

## Protected state and limitations

Six protected real-data hashes/missing states match the pre-task snapshot: agents,
tasks, orchestrations, executions, absent automations store and Kite memory. Actual
DATA_DIR was never used for project fixtures or started during verification.
The beta tag remains object `7bd5c0f09c15e2fca54c0dec1528c3fe6d9302e1`, peeled
`a0f9f58185a7658f6b513de08913643696b51aed`; local and remote tag were checked.
No dependency or third-party license changes.

Foundation support is deliberately conservative: macOS/Linux, trusted Git 2.39+,
ordinary SHA-1 format-0 repositories and passive config. Bounds may reject larger
repositories. GET is last-known state, untracked files/submodule worktrees are
excluded, and hostile same-user filesystem races/Git parser behavior are not OS
sandboxed. See ADR 0024 for cooperative deadlines, exact limits, local trust and
stopped-server scratch/registry recovery. Existing provider working directories
and DATA_DIR ownership semantics are retained. PR 25 is not started.

## Delivery

Implementation PR targets `main`. The final response and PR checks report the
exact pushed commit SHA and exact-head hosted CI status; local verification does
not substitute for hosted checks. No release tag is moved.
