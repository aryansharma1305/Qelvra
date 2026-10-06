# Changelog

## 0.1.0-beta.1 — release candidate

### Added

- Persistent local agents with individual filesystem workspaces and browser PTY terminals.
- Mailbox delivery, task execution, structured results and real Activity history/streaming.
- Provider discovery and Codex automation; deterministic development/test agents.
- Goal planning, explicit approval, worker scheduling, review/rework and final summaries.
- First-run guidance, honest preview labels, actionable provider errors/retries and route recovery.
- Source-run quick start, backup/limits/security documentation and release validation gates.

### Security

- Trusted localhost defaults, HTTP origin/Host protection and secure response headers.
- Server-owned commands, validated paths/contracts, bounded execution/event/quarantine output.
- Startup preflight preserving corrupt state, controlled crash recovery and process/watcher cleanup.

### Known limitations

Isolated workspaces do not merge into one shared repository. Local trusted-user deployment only; no authentication or cloud accounts. Codex is the only real automation integration. Other provider/platform support is narrower or unverified. Storage formats may change before stable release. Public publication awaits the owner's license decision and a passing release checklist.
