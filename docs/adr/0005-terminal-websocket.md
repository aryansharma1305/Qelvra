# ADR 0005: Browser terminal over WebSocket

- Status: accepted
- Date: 2026-10-03

## Context

The Terminal page must drive a real shell: keystrokes in, raw terminal bytes out,
continuously and in both directions. PR 4 built `PtyManager`; this connects the browser.

## Decision

- **WebSocket** (`GET /ws/terminal`, `@fastify/websocket`) because a terminal is a
  long-lived, bidirectional, low-latency byte stream; HTTP polling or SSE would add latency
  and a second channel for input.
- **The protocol lives in `@qelvra/shared`** (`terminal-protocol.ts`): Zod discriminated
  unions for client messages (`terminal.create | input | resize | terminate`) and server
  messages (`terminal.created | output | exit | error`). The server validates every client
  message; the browser validates every server message. Malformed messages get
  `terminal.error` (`TERMINAL_INVALID_MESSAGE`) and the connection stays open; binary frames
  close it with 1008.
- **Layering**: `terminal-gateway.ts` (transport: origin, framing, validation, ownership)
  depends on `PtyManager`; `PtyManager` knows nothing about WebSockets.
- **Ownership**: a connection owns at most one live PTY. Session ids are server-generated
  (`term-<uuid>`); a client can only refer to the id it was given. Unknown and foreign ids
  get the same `TERMINAL_SESSION_NOT_FOUND`, so connections cannot probe each other.
  `terminal.create` carries only a size: the shell (allowlisted `ShellProvider`) and cwd
  (`WORKSPACE_ROOT`) are always the server's choice.
- **Sessions are ephemeral.** Closing the socket (navigation, refresh, tab close, network
  loss) terminates its PTY via `PtyManager.terminate()` (process-tree kill, ADR 0004).
  Reconnecting starts a new PTY; nothing pretends the old one survived. Persistent,
  re-attachable sessions belong with agents, where a process must outlive a browser tab.
- **No backend scrollback.** Output is streamed, not stored; xterm keeps 5,000 lines
  client-side. Storing terminal output would also mean storing whatever secrets appear in
  it, which deserves its own decision.
- **Security boundary**: loopback binding (ADR 0003); the upgrade is refused (HTTP 403)
  unless `Origin` exactly matches a `WEB_ORIGIN` entry — browsers always send it, so a
  missing Origin is also refused (other local programs can already run shells, so the check
  targets cross-site browser pages); frames over 256 KB are rejected by the transport
  (close 1009) and any single input over 64 KB by the schema; terminal sizes are bounded by
  `PtyManager`. There is no authentication yet, which is why the server must stay on
  loopback.
- **Logging**: connection opened/closed, session created/exited and protocol errors are
  logged with ids. Terminal input and output are never logged.
- **Browser**: `RealTerminal` (`@xterm/xterm` + `@xterm/addon-fit`) waits for
  `terminal.created` before accepting input, fits via a debounced `ResizeObserver`
  (resize messages only when the grid changes), and disposes xterm, the observer and the
  socket on unmount. There is no automatic reconnect; the pane offers "Restart", which
  starts a fresh session, so a dead server cannot cause a reconnect/PTY-spawn loop.
- **UI scope**: only the first terminal pane is live. Its chrome and size are unchanged
  (the design-parity test asserts the pane's box and masks only its contents). The other
  pane, agent tabs and command bar remain design mock-ups until agents exist.
