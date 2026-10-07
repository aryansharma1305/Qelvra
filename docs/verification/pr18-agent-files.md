# PR 18: Agent workspace Files verification

PR 18 starts the v0.2 feature line. Shared Projects and Git worktrees remain deferred.
The published beta tag, release assets and real user DATA_DIR remain unchanged.

## Implementation receipt

1. **Created files:** `packages/shared/src/files.ts`,
   `apps/server/src/files/index.ts`, `apps/server/src/files/file-routes.ts`,
   `apps/server/src/files/workspace-file-service.ts`,
   `apps/web/src/pages/files/FilesPage.tsx`, `docs/adr/0018-agent-files.md`,
   `docs/verification/pr18-agent-files.md`, `tests/unit/workspace-files.test.ts`,
   `tests/unit/web-files-api.test.ts`,
   `tests/integration/server/workspace-files-api.test.ts`, `tests/e2e/files.spec.ts`,
   `tests/design/files.spec.ts`.
2. **Modified files:** `README.md` (one bullet), `docs/architecture.md`,
   `apps/server/src/app.ts`, `apps/server/src/workspaces/agent-workspace-manager.ts`,
   `packages/shared/src/index.ts`, `packages/shared/src/api.ts`,
   `packages/shared/src/activity-event.ts`, `apps/web/src/app/router.tsx`,
   `apps/web/src/lib/api.ts`, `apps/web/src/features/activity/format-activity.ts`,
   `tests/unit/activity-schema.test.ts`, `tests/unit/web-activity.test.ts`,
   `tests/e2e/navigation.spec.ts`.
3. **Service:** WorkspaceFileService exposes list, stat, readText, writeText, create,
   move and delete. It owns filesystem operations and serializes them per agent.
4. **Endpoints:** Under `/api/agents/:id/files`: GET root with optional relative
   path, GET /entry, GET /content, PUT /content, POST /file, POST /directory,
   POST /move, DELETE root. Create returns 201; delete returns 204.
   There is no server-global filesystem route.
5. **Shared schemas:** Strict Zod path, entry, listing, text/revision, response,
   create/write/move/delete schemas. Central API functions validate responses.
6. **Path security:** Registered agent selects the server-controlled root.
   AgentWorkspaceManager's resolveEntry extends existing validation: containment,
   component lstat/realpath, validated destination parents and repeated fixed-parent
   checks. Traversal, absolute/drive paths, backslashes, controls, encoded traversal
   and reserved temporary names fail closed. Dotfiles and spaces work.
7. **Symlinks:** Direct, nested and internal aliases are unsupported, as are
   hard-linked regular files and special files. Metadata never follows them.
   Recursive deletion refuses unsafe descendants.
8. **Content:** Valid UTF-8 only, fatal decoding and conservative binary-control
   rejection; invalid bytes return FILE_BINARY without garbage. UTF-8 BOM is
   preserved. Unsupported entries have read-only UI states.
9. **Bounds:** 1 MiB UTF-8 bytes for reads/saves; bounded descriptor reads even during
   growth. Listings cap at 2,000 entries. Recursive deletion caps at 2,000 entries
   and 64 levels. UI checks metadata before fetching oversized content.
10. **Atomic saves:** Exclusive sibling temporary file, write/fsync, parent/revision
    revalidation, atomic rename. Injected publication failure keeps the old file and
    cleans the temp. Host write permissions are respected; no chmod repair.
11. **Delete:** Root forbidden; nonrecursive default. UI confirms every deletion,
    explicitly describing folder contents. Bounded traversal preflights and
    rechecks inode/device identities. No raw recursive rm of browser input.
12. **Concurrency:** SHA-256 revision covers content and stat metadata. Changed disk
    files return FILE_CHANGED_ON_DISK; edits remain in UI. No force overwrite.
13. **Layout:** Existing app shell/tokens/fonts; desktop directory/editor columns,
    mobile stacked panels with a separate filename row. Lazy browsing, breadcrumbs,
    parent navigation, Refresh and real metadata.
14. **Agent selection:** Real registry name/role; selecting an agent loads its root.
    Relative URL queries preserve deep links. Empty/disconnected states offer recovery.
15. **Editor:** Plain textarea, dirty state, Save, Cmd/Ctrl+S, success/error status,
    Reload file. New typing during a save remains dirty. No added editor dependency.
16. **Unsaved changes:** Confirmation before file/agent/route changes and reload.
    Cancel retains edits, discard navigates, unload is protected. Pending mutations
    block conflicting navigation.
17. **Activity:** Successful user API mutations emit file.created/updated/renamed/
    deleted with agentId, relativePath and optional previousPath. No contents,
    absolute paths or provider-write watcher noise; formatter links to Files.

## Validation receipt

18. **Unit tests:** 24 workspace cases and two client cases cover CRUD, sorting,
    filenames, permissions, content bounds, conflicts and failure cleanup.
19. **Security tests:** Unsafe paths across every operation; direct/nested/internal
    symlinks, move/delete escape, replaced roots/parents, cross-agent reads, hard
    links, deleted records, unsafe recursive descendants and Activity content fields.
20. **Integration:** Three real server cases cover REST contracts, strict fields,
    controlled errors, metadata-only Activity and development Fake execution.
21. **E2E:** Six Files flows cover demo/hello.txt, HELLO_QELVRA save/refresh,
    rename/delete, unsaved cancellation/discard/save, binary/large states,
    conflicts, 500 entries, empty agents and disconnected recovery.
22. **Agent-written files:** Browser execution fixture produces fixture.txt and Files
    reads it. Server integration reads development Fake's actual fake-result.txt.
    Paid Codex smoke skipped; CLI/auth is not required by CI.
23. **Five repeated runs:** 29 Files-focused tests / three files passed in each of
    five consecutive runs. Focused browser run passed 6/6 with zero retries.
24. **Design:** No Files Stitch reference existed. New layout checks use incumbent
    tokens and assert primary-action contrast, readable filename, font/background
    and no overflow. Existing global references/tolerances are unchanged.
    Full design suite passed 43/43; the final Files capture check also passed
    after the mobile filename fix. Fresh finish review: ship; documenter: no token drift.
25. **Full suite:** 659 Vitest tests / 59 files passed; format, lint, typecheck and
    build passed. Production smoke, five-cycle release smoke and beta publication
    guard passed. Full browser E2E passed 83/83 with zero retries (2.7 minutes); design
    passed 43/43 with zero retries (4.0 minutes).
26. **Limitations:** Isolated workspaces, no shared projects/Git merges/watchers,
    collaborative editor, undo, binary preview or large text editing. Node's
    portable filesystem APIs cannot fully sandbox a hostile local process racing
    ancestor replacement or the final validation/syscall window. Saves are atomic
    but mutations are not multi-file crash transactions. Interrupted file moves may
    leave a hard-link pair that Files subsequently rejects. External changes can
    cause partial recursive deletion. ADR 0018 documents the trusted-local boundary.
27. **Commands:** Below. Full E2E also uses a short disposable source checkout:
    a pre-existing terminal test assumes the entire pwd suffix occupies one row,
    which wraps under a long managed-worktree path. No terminal product behavior,
    assertion, timeout or global tolerance was changed to hide that assumption.
28. **Commit:** Exact implementation SHA is recorded by the PR head/final handoff;
    this report is included in that commit.
29. **GitHub CI:** Exact pushed-head result and link are recorded in the PR/final
    handoff. Local results are not represented as hosted CI results.
30. **Suggested commit:** `feat(files): add secure agent workspace browser`.

```bash
export PATH=/Users/gugloo/.nvm/versions/node/v22.23.2/bin:$PATH
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
for run in 1 2 3 4 5; do
  npx vitest run tests/unit/workspace-files.test.ts tests/unit/web-files-api.test.ts tests/integration/server/workspace-files-api.test.ts
done
CI=1 npm run test:e2e -- tests/e2e/files.spec.ts --workers=1 --retries=0
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design -- --retries=0
npm run production:smoke
npm run release:smoke
RELEASE_TAG=v0.1.0-beta.1 node scripts/check-release.mjs
```

Protected-state audit: real agents.json SHA-256 remained
`1b23983b5b59482d45b217d27b0eb9c5e73f7c527cdc167e672c2f8b0fa1991e`;
main stayed clean. Beta tag object remains
`7bd5c0f09c15e2fca54c0dec1528c3fe6d9302e1`, targeting
`a0f9f58185a7658f6b513de08913643696b51aed`. Tests use disposable DATA_DIR roots.
Main's existing localhost process was left running.
