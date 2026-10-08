# ADR 0019: Persistent per-agent Markdown memory

Status: Accepted (v0.2 development)

## Boundary and reuse

Memory maps only to the server-controlled `DATA_DIR/hive/agents/<id>/memory.md`.
Requests select a registered agent, never a path or filename. Extend
AgentWorkspaceManager's existing fixed-parent, lstat/realpath, no-follow and
hard-link checks. PR 18's bounded UTF-8 read, revision and atomic-save logic is
extracted into one shared filesystem primitive used by both services.

GET `/api/agents/:id/memory` returns agentId, content, byte size, modifiedAt and
revision. PUT accepts only content and expectedRevision. All contracts are strict
shared Zod schemas. Missing legacy memory uses the existing exclusive workspace
initializer and unchanged `# Agent Memory` template; existing content is preserved.

## Text, publication and concurrency

The limit is 256 KiB of UTF-8 bytes. Invalid UTF-8, binary control bytes, symlinks,
hard links and special files are rejected with controlled errors. Reads are bounded
even during growth. Memory operations serialize per agent. Revision hashes cover
content and stat metadata; stale saves return MEMORY_CHANGED_ON_DISK. No overwrite
bypass or merge editor exists. Saves exclusively create a sibling temporary file,
write/fsync, revalidate parents and revision, then atomically rename. Failures
before publication preserve the old memory and clean up the owned temporary file.
Host permissions remain authoritative; no chmod repair is performed.

Node's portable filesystem APIs retain the trusted-local-user model: ancestor
replacement and external writes in the final check/syscall window cannot be fully
sandboxed. This is not public or hostile-user filesystem isolation.

## Privacy and execution

Successful saves publish memory.updated with agentId and size only. Reads and legacy
initialization do not emit updates. Contents never enter Activity, service logs or
analytics. The existing execution pipeline does not read memory.md into provider
prompts; PR 19 leaves that behavior unchanged and adds no provider transmission.
Memory is persistent notes stored on disk, not a claim of autonomous AI recall.

## UI and deferred features

The existing app shell and Files editor patterns provide a real-agent selector,
plain Markdown textarea, byte/character count, modified time, Save/Cmd-or-Ctrl-S,
Reload, dirty state and accessible conflict recovery. Unsaved edits are protected
before agent/route changes, reload and unload. No HTML preview or destructive reset
is added. Vector/semantic memory, embeddings, summarization and shared project
memory remain explicitly planned. The beta tag and release artifacts are unchanged.

## Direction contract

THESIS: Let a user inspect and safely edit one agent's real persisted notes. The
Markdown document is the primary content; there are no simulated vector entries.

OWN-WORLD: Preserve Qelvra's existing dark shell, Geist UI, JetBrains Mono editor,
lavender primary actions, surface tokens, border/radius and native controls.

STORY: Select a registered agent, understand where notes live and when they changed,
edit, save with a revision, then see a clear saved or conflict state.

FIRST VIEWPORT: Existing header/sidebar; Memory heading and real-agent selector above
a broad editor. Desktop shows a narrow metadata/privacy panel beside it. Mobile
stacks the same content. Save and Reload remain visible beside state text.

FORM: Plain accessible Markdown textarea with bounded UTF-8 byte count and modified
time. No preview rendering, heavyweight editor, reset or unrelated app changes.

SIGNATURE: Revision conflicts preserve the user's edits and require explicit reload.
Native confirmation protects unsaved navigation and unload. Notes remain local and
vector/semantic memory is honestly deferred.
