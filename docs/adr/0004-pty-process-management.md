# ADR 0004: PTY process management

- Status: accepted
- Date: 2026-10-03

## Context

Agents run as CLI processes in real terminals. Before any WebSocket terminal (PR 5) or
agent model (PR 6), the server needs one owner for terminal processes that can start,
drive, observe and reliably stop them.

## Decision

- **node-pty** provides pseudo-terminals. It is the de-facto standard (VS Code, Hyper),
  gives real TTY semantics (job control, resize, colour) that `child_process` pipes cannot,
  and works on macOS, Linux and Windows (ConPTY).
- **`PtyManager`** (`apps/server/src/pty`) owns every PTY: `createSession`, `write`,
  `resize`, `onData`/`onExit` (disposable subscriptions), `terminate`, `terminateAll`.
  Native `IPty` objects never leave the module; callers get `PtySessionInfo` snapshots.
  `createApp()` creates one manager (or accepts an injected one) as `app.pty`.
- **Shells are chosen by the server.** A `ShellProvider` resolves the program: `$SHELL`
  only if it is on a fixed allowlist (zsh/bash/sh in standard locations) and executable,
  else `/bin/zsh`, `/bin/bash`, `/bin/sh`; on Windows `pwsh`, then `powershell`. Callers
  cannot pass an executable. Later AI CLI providers implement the same interface.
- **Working directories are confined** to `WORKSPACE_ROOT` (default: server cwd). Paths
  are resolved and symlinks followed (`realpath`) before the containment check.
- **Lifecycle has one cleanup path.** Natural exit, `terminate()` and forced cleanup all
  go through the same handler: status `exited`, exit code/signal recorded, exit listeners
  called once, native subscriptions disposed, entry removed. Later writes fail with
  `PTY_SESSION_NOT_FOUND`; writes during shutdown with `PTY_SESSION_NOT_RUNNING`.
- **Termination kills everything the session started.** The shell's descendants are
  frozen with SIGSTOP (re-listed via `ps` until stable, so nothing can fork away), then
  the shell, its process group and the frozen processes get SIGHUP (like closing a
  terminal window) and SIGCONT, and a grace period (3 s); anything left — including
  HUP-ignoring/`nohup` children — is SIGKILLed, and `terminate()` returns only once the
  processes are gone. If `ps` is unavailable it still hangs up the shell and its process
  group. A shell's session ID would be the natural key, but macOS tooling cannot query it,
  hence the tree walk.
- **The shell itself is never frozen.** If the server dies mid-termination (e.g. SIGKILL),
  the running shell still receives the kernel's hangup when the PTY closes and exits, and
  the kernel hangs up and resumes its orphaned stopped children. Freezing the session
  leader would leave it stopped forever; a test kills a manager right after the freeze and
  verifies the OS cleans up (found when Playwright SIGKILLed the dev server in PR 5).
- **Shutdown**: the Fastify `onClose` hook calls `terminateAll()`; SIGINT, SIGTERM and
  SIGHUP (terminal window closed) call `app.close()`. Playwright stops its dev servers
  with SIGINT so tests exercise this path. A test sends a real SIGINT to a server process and checks no PTY process
  survives.
- **Errors** are `PtyError` with codes (`PTY_SESSION_EXISTS`, `PTY_SESSION_NOT_FOUND`,
  `PTY_SESSION_NOT_RUNNING`, `PTY_SPAWN_FAILED`, `PTY_INVALID_SIZE`, `PTY_INVALID_CWD`,
  `PTY_INVALID_ID`, `PTY_INVALID_INPUT`, `PTY_NO_SHELL`). Messages are client-safe; native
  errors are kept in `cause` and logged.
- **No HTTP/WebSocket surface yet.** PR 5 adds the terminal protocol on top of this API.

## Why separate from agents

An agent is a policy layer (role, provider, workspace, mailbox, status); a PTY is a
process. Keeping `PtyManager` free of agent and transport concepts lets the WebSocket
gateway and the future `AgentManager` both build on it, and keeps process safety in one
tested place.

## Native dependency implications

- node-pty is a native addon. Version 1.1.0 ships N-API prebuilds for macOS (arm64/x64)
  and Windows; on Linux (including CI) it compiles on install and needs Python 3, make
  and a C++ compiler.
- Some npm installs drop the executable bit from the macOS prebuild's `spawn-helper`,
  making every spawn fail with `posix_spawnp failed`. `apps/server/scripts/fix-node-pty.mjs`
  (server `postinstall`) restores it.
- node-pty stays external to the esbuild bundle and loads from `node_modules`.
