# ADR 0010: Automatic filesystem message delivery

Status: Accepted (PR 10)

## Separation and public API

`MessageRouter` depends on `MailboxManager`, `AgentWorkspaceManager` and registry
identity/events. It imports no runtime, PTY, provider, shell or transport implementation.
A stopped recipient receives exactly the same envelope as a running recipient. Bodies
remain opaque data, with the PR 9 schema and size limits unchanged.

Internal methods are `start()`, `stop()`, `isRunning()`, `rescan()` and `status()`
(running, delivered, quarantined, inFlight). `processEntry(agentId, filename)` is the
narrow internal watcher/test hook, admitting registered agent IDs and JSON leaf names
only; it takes no arbitrary path. These methods have no HTTP/browser endpoints.

## Watcher strategy

Chokidar 4 watches the validated `hive/agents` container with depth 2, no symlink
following and an ignored predicate that admits only agent directories, their outbox
subdirectory and nonhidden `.json` leaf files. Workspaces, inboxes, metadata, temp,
non-JSON and editor swap files are excluded. No periodic rescan/polling scheduler is
added. The tree watcher can retain descriptors for a deleted agent's preserved outbox;
processing rejects unregistered owners before reading, publication and acknowledgement.
This keeps ID recreation observable without an unwatch/add race.

Initialization waits for watcher readiness (maximum five seconds), rechecks managed
parents, then scans all known outboxes. Chokidar's initial add events are suppressed;
the explicit startup scan covers offline messages. Events arriving during that scan
are buffered and processed afterward, so delayed watcher events cannot overtake ordered
backlog. Valid backlog is processed in
createdAt/ID order within a sender, concurrently across senders. Live events can
interleave and have no strict per-sender or global ordering guarantee.

A registry-created subscription refreshes/adds the validated outbox and scans preserved
backlog. Registry creation precedes PR 8 workspace initialization; refresh waits at most
0/100/300/1000 milliseconds for the owner to create its layout. The router does not
create agent workspaces. The bounded tree watcher also observes later directory/file
creation. Failed refresh is logged; explicit rescan/restart can recover it.

## Delivery algorithm and durability

1. Deduplicate the stable `[agentId, filename]` source key in an in-flight map. At most
   four deliveries execute concurrently; additional accepted sources wait without loading
   bodies/opening files. Stop drains active work and leaves queued sources pending.
2. Read through MailboxManager, validating schema, filename ID and sender ownership.
3. Recheck sender registration and recipient existence at delivery time.
4. Call `deliverInboxMessage(recipientId, message)`. This validates recipient binding,
   preserves all six fields and uses the same exclusive atomic publication helper as
   outbox writing: same-directory exclusive 0600 temp → complete JSON → file fsync →
   close → exclusive hard link to final → directory fsync → temp unlink.
5. Only after successful destination publication/durability, acknowledge the source.
   The acknowledgement checks that the current source matches the delivered snapshot.
6. Emit a body-free delivery event. Always release the in-flight key in finally.

Node's portable rename can overwrite existing files, so publication continues to use
PR 9's exclusive hard-link discipline, with no overwrite fallback. The inbox method
preserves the original ID/timestamp. The source remains intact if publication or the
inbox durability barrier fails. Hard-link and POSIX directory-fsync support are required;
unsupported filesystems fail safely, retaining sources.

## Idempotency and crash recovery

If the destination exists, the mailbox reads/validates it and compares id, from, to,
type, body and createdAt, independent of JSON whitespace/key order. Exact agreement
means already delivered: sync the existing file and directory, then acknowledge the
source. Invalid or conflicting destinations are never overwritten and produce
`MAILBOX_DESTINATION_CONFLICT`.

This recovers a process crash after inbox publication but before source deletion.
Duplicate filesystem events share one promise while in flight; events after completion
find no source and do nothing. The guarantee is at-least-once recovery, with destination
idempotency while its matching inbox copy remains present. There is no durable consumed-ID
ledger and no exactly-once claim after a future consumer removes that inbox copy.

## Retry and failure policy

Invalid schema/JSON/UTF-8/ID/ownership, oversized content, absent recipients, unsafe
entries and destination conflicts are permanent. Regular permanent source files are
quarantined. Read/write failures and an unavailable layout are transient: three total
attempts, with 100 ms then 300 ms backoff. Delay timers are cancelled on stop.

After transient exhaustion, the source remains safely pending and its key is blocked
in memory to avoid an endless watcher-event retry loop. Explicit `rescan()` or restart
clears that state. Failed quarantine likewise retains the source and blocks the key.
A permanent error may be quarantined immediately; manually authored files must be
published atomically. The router is not a chunked-write/editor completion detector.

## Central quarantine

Location: `DATA_DIR/hive/quarantine/<sender>/<server-generated-uuid>/`:

- `message.json`: preserved raw source inode, including malformed/oversized JSON.
- `error.json`: sender, sanitized bounded original filename, controlled error code and
  quarantine timestamp. No body is included in metadata/logs.

Central storage avoids changing every agent layout and separates undeliverable data
from routable outboxes. Original filenames never choose destination paths. Workspace
Manager creates/checks fixed parents and generated private directories (0700), reusing
its existing agent-ID, containment, lstat and realpath rules. New quarantine parent
entries are synced. Metadata is published exclusively/atomically (0600). The regular
source is opened no-follow/nonblocking, checked and fsynced, linked without overwrite,
and the linked inode/type verified; the quarantine directory is synced before source
unlink. Huge files are moved by inode/entry, never loaded into memory for quarantine.
Raw file permissions are preserved inside private directories.

Symlinks, devices, directories and other unsafe source entries are left for manual
repair, with a controlled quarantine-failed event; they are never followed/copied.
If quarantine fails partway, metadata/raw copies may remain for inspection alongside
the still-pending source. No recursive deletion or automatic quarantine cleanup exists.

## Lifecycle and events

Fastify constructs `app.router`, starts it in onReady before serving, and awaits its
stop before shutting down runtimes/PTYs. Watcher initialization/readiness or unsafe
startup layouts fail readiness/startup. A watcher error after startup closes the router
and asks Fastify to close, rather than silently serving without delivery.

Stop rejects new processing, disposes registry subscription, cancels backoff/refresh
pauses, closes watcher, and awaits startup, maintenance and in-flight deliveries. A
publication already underway can finish acknowledgement; untouched backlog stays on
disk for restart. Concurrent start/stop calls and cancellation before watcher ready
are handled. Existing SIGINT/SIGTERM/SIGHUP handlers still own process shutdown.

Internal callback/log events: `message.detected`, `message.delivered`,
`message.delivery_failed`, `message.quarantined`. Fields are validated message ID,
source/recipient, message type, error code and recovered flag. No message bodies,
original filenames, raw errors or filesystem paths are logged by the router. Callback
exceptions are isolated. Counts are process-local and cumulative across router restarts.
No event database or Activity subsystem is added.

## Limits and deferred behavior

PR 8/9's same-user model remains: filesystem checks are not an OS sandbox. Local shells
can modify contents, hard-linked aliases or parent directories between portable Node
path checks. Inode checks and snapshot acknowledgement reduce accidental races but do
not eliminate malicious same-user TOCTOU. Quarantine hard links can still share an
inode with other same-user aliases; forensic immutability is not claimed. Parent
workspace durability remains the PR 8 model; fsync barriers are not a filesystem-agnostic
power-loss guarantee. Listings/rescans are not transactional; no multi-process lock,
mailbox count quota, persistent retry scheduler or cross-host routing exists. Retry
exhaustion requires rescan/restart; the service does not continuously poll failed files.

PTY notifications, agent interpretation, task execution, orchestrator behavior,
provider-specific behavior and a messaging UI are deferred. PR 11 can consume delivery
events/inbox files without coupling this router to runtime or executing message text.
