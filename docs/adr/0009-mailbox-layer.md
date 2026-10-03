# ADR 0009: Internal agent mailbox layer

Status: Accepted (PR 9)

## Decision

`MailboxManager` depends on `AgentWorkspaceManager` for fixed, validated inbox/outbox
locations and on `AgentRegistry.get` for identities. `createApp` exposes it internally
as `app.mailbox`. It has no dependency on agent runtimes, PTYs or transport APIs. A
stopped agent can prepare messages. No frontend, messaging endpoints, watcher, router,
provider integration, shell execution or automatic delivery is added.

## V1 contract

The canonical strict Zod `MessageSchema` lives in `packages/shared/src/message.ts`:

```ts
{
  id: string; // msg-<lowercase UUID v4>
  from: string; // shared AgentIdSchema
  to: string; // shared AgentIdSchema
  type: "task" | "message" | "result" | "status" | "error";
  body: string;
  createdAt: string; // valid UTC ISO timestamp
}
```

Unknown fields are rejected. No thread, reply-to or generic metadata is needed in V1.
Bodies are nonempty opaque text, preserved without trimming or interpretation, with
no null bytes and a maximum of **65,536 UTF-8 bytes**. This bounds message content
while accommodating ordinary prompts/results. The maximum serialized file is
**394,240 bytes** (six bytes per body byte for worst-case JSON escaping plus 1,024
bytes of envelope overhead). Readers stat first and enforce the limit again while
reading, so growing files cannot cause unbounded allocation. UTF-8 decoding is strict.

## API and ownership

- `writeOutboxMessage(agentId, { to, type, body }): Promise<Message>` creates and writes
  the message in one operation. The owning sender must be registered and its existing
  outbox must pass workspace checks. The recipient must be a registered agent; its
  lifecycle state does not matter. No workspace is implicitly created by sending.
- `readMessage(agentId, "inbox" | "outbox", messageId): Promise<Message>` validates
  the filename-derived ID, JSON, schema and ownership. Envelope ID must equal filename;
  `from` must match an outbox owner and `to` must match an inbox owner.
- `listMessages(agentId, box): Promise<{ messages, invalid }>` returns valid messages
  ordered by timestamp ascending, then ID lexically. Invalid metadata is ordered by
  filename and contains only `filename` and a controlled reason code.
- `acknowledgeMessage(agentId, box, messageId): Promise<boolean>` validates then unlinks
  a single file. It returns false if already missing, including concurrent removal.
  Calls for the same message are serialized within one manager so concurrent acknowledgements
  report a single successful removal. Both boxes are supported for explicit internal maintenance; outbox acknowledgement
  never happens automatically. Invalid entries are left untouched for owner repair.

The manager sets `from`, UUID and timestamp. Input is strict: attempted sender, ID or
timestamp spoofing is rejected rather than accepted. Creation uses `crypto.randomUUID`
and server time; optional constructor UUID/clock functions are server-only test seams.
Recipient validation is a creation-time lookup, not a transactional lock against later
agent deletion. Read/acknowledgement validate stored addresses but do not require the
other party to remain registered, allowing old messages to be inspected.

## Atomic publication and collisions

Each write opens a random `.tmp-<message-id>-<uuid>` file in the same outbox using
exclusive creation, no-follow and Unix mode 0600 (subject to a stricter umask). It writes
complete JSON, fsyncs the file, closes it and rechecks the managed directory before
publication. Existing workspace directories retain the PR 8 strategy (new dirs 0700).

**Deliberate deviation from rename:** Node's portable `rename` overwrites an existing
final file. A preflight existence check cannot prevent a race. Instead, `link(temp,
final)` atomically creates the final directory entry only if absent, then `unlink(temp)`
removes the temporary entry. The final name always refers to the complete fsynced
inode, never partial JSON. Same-directory publication uses the same filesystem.
There is no overwrite fallback on filesystems lacking hard-link support: fail safely.
This temporary second link is why message reads allow hard links; reads are bounded,
validated and never modify the inode. Acknowledgement unlinks only the mailbox entry,
never its other names. Metadata file reads in WorkspaceManager still reject hard links.

Collisions (including final symlinks/directories) retry with fresh server-generated IDs
up to three attempts, then return `MAILBOX_DUPLICATE_MESSAGE`. Failures before
publication clean up only the operation's temporary filename where practical. A cleanup
failure after publication does not report a failed send: the complete message already
exists, and retrying would duplicate it. Such a crash/cleanup remainder is a `.tmp-*`
entry, ignored during listing; there is no automatic stale-file cleanup in V1.

File fsync supports completed-content persistence. Directory entries are not fsynced;
this is atomic visibility, not a guarantee against power-loss loss of directory entries.

## Invalid/manual entries and errors

The workspace accessor admits only fixed inbox/outbox names and reuses existing ID,
containment, realpath and parent symlink checks. Message names derive only from validated
UUID IDs. Reads reject symlinks and nonregular files, open no-follow/nonblocking, verify
identity against lstat, and check size/mtime/ctime again after bounded reading.

`.tmp-*` entries are ignored. Non-JSON files are reported as `NON_JSON_FILE`. Invalid
filenames, malformed JSON/UTF-8, schema errors and ownership mismatches are reported as
`MAILBOX_INVALID_MESSAGE`; oversized files as `MAILBOX_MESSAGE_TOO_LARGE`; unsafe entries
as `MAILBOX_UNSAFE_ENTRY`. One invalid file does not prevent valid messages being listed.
A file removed between enumeration and read is skipped. Directory failures are controlled
errors, not silently empty mailboxes. Error messages contain code names only; underlying
filesystem errors are retained as internal causes, with no public endpoint exposing them.

## Limits and next milestone

Paths and Unix permissions are safety checks, not an OS sandbox: local shells run as the
server user. A same-user process can manually edit mailbox contents, replace entries or
rename parents between checks. Portable Node APIs do not provide descriptor-relative
operations or conditional unlink; those races are not claimed to be eliminated. There
are no signatures, cross-process locks, transactionally consistent listing, mailbox count
quotas or authorization endpoints. Listings are snapshots assembled from validated reads;
concurrent file changes can produce controlled read errors. Hard-linked manual messages
are validated data, not proof of authorship. Server-controlled authorship applies to
manager-created messages, not malicious filesystem writers.

A Nova → Atlas message remains exclusively in Nova's outbox. PR 10 will own delivery,
retry and consumption semantics. PR 9 never copies, moves, notifies or acknowledges it
on Atlas' behalf. No orchestrator or provider-specific behavior is implemented.
