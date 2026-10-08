# PR 19: Persistent agent Memory verification

This is a v0.2 milestone stacked on PR 18 while that PR remains open. The released
v0.1.0-beta.1 tag and artifacts remain unchanged. Tests use disposable storage.

## Implementation receipt

1. **Created:** `apps/server/src/lib/bounded-text-file.ts`;
   `apps/server/src/memory/agent-memory-service.ts`, `memory-routes.ts`, `index.ts`;
   `apps/web/src/pages/memory/MemoryPage.tsx`; `packages/shared/src/memory.ts`;
   `docs/adr/0019-agent-memory.md`; this report; `tests/unit/agent-memory.test.ts`,
   `tests/unit/web-memory-api.test.ts`, `tests/integration/server/agent-memory-api.test.ts`,
   `tests/e2e/memory.spec.ts`, `tests/design/memory.spec.ts`.
2. **Modified:** `README.md` (one bullet), `docs/architecture.md`,
   `apps/server/src/app.ts`, `apps/server/src/files/workspace-file-service.ts`,
   `apps/server/src/workspaces/agent-workspace-manager.ts`, `apps/web/src/app/router.tsx`,
   `apps/web/src/lib/api.ts`, `apps/web/src/features/activity/format-activity.ts`,
   `packages/shared/src/index.ts`, `packages/shared/src/api.ts`,
   `packages/shared/src/activity-event.ts`, `tests/e2e/navigation.spec.ts`,
   `tests/unit/activity-schema.test.ts`, `tests/unit/web-activity.test.ts`.
3. **MemoryService:** AgentMemoryService.get(agentId), update(agentId,
   { content, expectedRevision }). Per-agent queue, registered-agent check,
   canonical legacy initialization, shared bounded text operations and safe logging.
4. **REST:** GET and PUT `/api/agents/:id/memory`. PUT accepts content and
   expectedRevision only. Queries, paths, filenames and unknown body fields are
   rejected. There is no general memory-file or server-global path endpoint.
5. **Schemas:** Strict AgentMemory, AgentMemoryResponse and UpdateAgentMemoryRequest
   Zod schemas; agentId/content/size/modifiedAt/revision response; centralized
   getAgentMemory/updateAgentMemory frontend functions validate responses.
6. **Limit:** 256 KiB (262,144 bytes) of UTF-8. Descriptor reads are bounded even if
   the file grows. Oversized text is rejected on read/save; the UI reports byte
   count and disables oversized saves.
7. **Revision:** SHA-256 of content plus inode/device/size/mtime/ctime/mode.
   A required expectedRevision detects changed files and stale clients.
8. **Atomic write:** PR 18 read/revision/save primitives were extracted into
   bounded-text-file.ts and are shared by Files and Memory. Exclusive private
   sibling temporary, UTF-8 write, fsync, parent/revision recheck, atomic rename.
   Injected publication failure preserves original notes and removes the owned
   temporary file. No chmod repair; host permissions remain authoritative.
9. **Legacy:** Only absent memory triggers existing AgentWorkspaceManager's
   exclusive initializer and unchanged "# Agent Memory / No persistent notes yet."
   template. Existing notes are preserved. Reads/initialization emit no memory.updated.
10. **Path/isolation:** The backend selects exactly
    `hive/agents/<agent-id>/memory.md`. getMemoryEntry reuses canonical fixed-parent
    checks, lstat/realpath containment and regular-file/hard-link rejection.
    Descriptor opens are no-follow. Invalid identities, direct/internal symlinks
    and hard links are rejected; distinct agents retain distinct notes.
11. **Layout:** Existing app shell/fonts/tokens; real-agent selector above a wide
    editor, metadata/privacy help beside it on desktop and below it on mobile.
    No fake cards, vector records or unrelated app redesign.
12. **Editor:** Plain Markdown textarea, accessible label, Save, Cmd/Ctrl+S,
    dirty/saving/saved text, modified time, Unicode character and UTF-8 byte counts.
    No heavyweight dependency, HTML preview or Reset/Clear control.
13. **Unsaved changes:** Native confirmation before agent/route changes or Reload;
    cancel retains edits, discard proceeds. Unload is protected. Pending saves block
    conflicting navigation; notes typed during a save remain dirty.
14. **Conflict:** MEMORY_CHANGED_ON_DISK leaves edits intact. Accessible inline
    alert offers Reload changed memory or Keep editing. Reload requires explicit
    discard. No overwrite bypass or merge editor.
15. **Activity:** Successful saves emit memory.updated with agentId and size only.
    Formatter displays "Agent memory saved", agent identity and bytes, linking to
    the selected Memory page. Existing Activity history remains compatible.
16. **Privacy:** No contents in Activity, service logs or analytics. Service logger
    tests cover both successful and stale saves. Existing execution reads agent.md
    (8 KiB instructions) and does not read memory.md into prompts; that source and
    behavior are unchanged. This PR adds no provider transmission or prompt cost.
    Persisted notes are plain local Markdown, not encrypted secret storage.

## Validation receipt

17. **Unit:** 13 memory-service cases, including parameterized corruption fixtures,
    and two client cases cover template, BOM/Unicode/empty notes, isolation,
    legacy init, byte limit, invalid text, stale/concurrent saves, permissions,
    alias rejection, atomic failure cleanup and metadata-only logging/Activity.
18. **Integration:** Three real Fastify cases verify contracts, strict fields,
    controlled errors, unknown agents, malformed/traversal identities, isolation,
    legacy initialization, corrupted/oversized memory and metadata-only Activity.
19. **Browser:** Six Memory flows cover real notes, save/agent-switch persistence,
    Activity privacy, dirty guards, conflicts, legacy/corrupt/large states,
    empty/disconnected recovery and backend restart.
20. **Conflict E2E:** Browser keeps LOCAL_UNSAVED while another API client saves
    EXTERNAL_SAVED. Stale Save shows conflict and cannot change server notes.
    Keep editing preserves local text; explicit reload fetches the server version.
21. **Restart:** Integration closes/recreates the actual Fastify app with the same
    disposable DATA_DIR. Browser also saves notes, stops/restarts a separate real
    backend child process, reloads the page and verifies persistence.
22. **Five runs:** 18 Memory-focused tests / three files passed five consecutive
    times. Focused Memory browser passed 6/6 with zero retries (21.6 seconds).
23. **Design:** All 44 design checks passed (3.4 minutes), including deterministic
    Memory desktop/mobile coverage,
    verifying panels, editor font/background, enabled primary-action color and
    no horizontal overflow. No Memory Stitch reference existed; no global masking,
    baseline or tolerance changes. Finish review: ship; documenter: no material
    drift. Missing PRODUCT/DESIGN documents are pre-existing.
24. **Full suite:** 677 Vitest tests / 62 files passed (66.34 seconds); build and
    format/lint/typecheck passed. Production and five-cycle release smokes passed;
    unchanged beta publication guard passed. All 89 browser tests passed (2.8
    minutes), all 44 design checks passed (3.4 minutes), and both release UI checks
    passed. All browser suites used zero retries.
25. **Limitations:** Isolated agent notes only; no vector database, embeddings,
    semantic search, summarization, shared memory, watchers, Markdown preview,
    merge editor or AI prompt integration. Corrupt/unsafe files require host-side
    repair; the UI never replaces them with a template. Node portable filesystem
    APIs cannot fully sandbox hostile local ancestor replacement or writes in the
    final validation/syscall window, matching PR 18's trusted-local model. No
    cross-process collaborative editor or multi-file crash transaction is promised.
26. **Commands:** Below. Full browser verification uses a short disposable source
    checkout so the pre-existing terminal pwd-row assertion is not affected by
    long managed-worktree paths. No terminal assertion or timeout was weakened.
27. **Commit:** Exact PR head SHA is recorded in the PR/final handoff; this report
    is included in that commit.
28. **GitHub PR:** Recorded in the final handoff and attached to this chat. Base is
    PR 18's branch until that milestone merges.
29. **CI:** Exact pushed-head hosted result/link is recorded in the PR/final
    handoff. Local results are not substituted for hosted CI.
30. **Suggested commit:** `feat(memory): add persistent agent memory editor`.

```bash
export PATH=/Users/gugloo/.nvm/versions/node/v22.23.2/bin:$PATH
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
for run in 1 2 3 4 5; do
  npx vitest run tests/unit/agent-memory.test.ts tests/unit/web-memory-api.test.ts tests/integration/server/agent-memory-api.test.ts
done
CI=1 npm run test:e2e -- tests/e2e/memory.spec.ts --workers=1 --retries=0
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design -- --retries=0
npm run test:release -- --workers=1 --retries=0
npm run production:smoke
npm run release:smoke
RELEASE_TAG=v0.1.0-beta.1 node scripts/check-release.mjs
```

Protected-state baseline: real agents.json SHA-256
`1b23983b5b59482d45b217d27b0eb9c5e73f7c527cdc167e672c2f8b0fa1991e`.
All five existing real memory files, including Kite, have SHA-256
`0e4d0b69a534cd9fe193cbc3810423ed4aac9b2dfd2ca6a23a9241200f526fab`.
No destructive test uses that DATA_DIR. Main checkout is left untouched.
Beta tag object `7bd5c0f09c15e2fca54c0dec1528c3fe6d9302e1` still targets
`a0f9f58185a7658f6b513de08913643696b51aed`.
