# ADR 0003: Server foundation

- Status: accepted
- Date: 2026-10-03

## Context

The UI needs a privileged local backend (later: PTYs, agent workspaces, mailbox). PR 3
establishes only the server skeleton and browser connectivity.

## Decision

- **Fastify 5 + Zod** in `apps/server`. `createApp(config)` builds the app without
  listening (tests use `app.inject()`); `startServer()` listens; `index.ts` loads config,
  reads an optional `.env` (never overriding real environment variables) and shuts down
  gracefully on SIGINT/SIGTERM/SIGHUP with a 10 s force-exit.
- **Configuration** is environment-only and validated: `HOST` (default `127.0.0.1`),
  `PORT` (3001), `WEB_ORIGIN` (comma-separated, default `http://127.0.0.1:5173`),
  `LOG_LEVEL`. Invalid config fails fast with a readable message. A non-loopback `HOST`
  logs a warning because the API has no authentication yet.
- **Error envelope** `{ "error": { "code", "message" } }` for every non-2xx response,
  defined in `@qelvra/shared`. 5xx messages are replaced by "Internal server error";
  details only reach the server log. Known failures use `AppError(status, code, message)`.
- **CORS** allows exactly the configured `WEB_ORIGIN`s. The browser calls the API
  directly (`VITE_API_URL`, default `http://127.0.0.1:3001`) rather than through a Vite
  proxy, so the CORS policy is exercised in development as it will be in use.
- **API contracts live in `@qelvra/shared`** (`HealthResponseSchema`,
  `ApiErrorResponseSchema`); the web client validates every response against them.
- **Tooling**: `tsx watch` for development; `esbuild` bundles `dist/index.js` for
  `npm run build`, inlining `@qelvra/shared` (which ships TypeScript source) and keeping
  npm dependencies external. `tsx` already depends on esbuild, so no extra install.
- **`npm run dev`** runs web and server through `scripts/dev.mjs` (no dependency): prefixed
  output, Ctrl-C stops both, and one exiting stops the other.
- **UI**: the sidebar footer's "● ONLINE" became a live CHECKING / CONNECTED /
  DISCONNECTED indicator in the same style, polling `GET /api/health` every 10 s and on
  window focus / network recovery.

## Consequences

- Playwright starts both servers; e2e tests run against the real API.
- If the web app is opened from an origin not listed in `WEB_ORIGIN` (e.g.
  `http://localhost:5173` instead of `127.0.0.1`), the browser blocks the request and the
  UI shows DISCONNECTED. Add the origin to `WEB_ORIGIN` to allow it.
- Logs are structured JSON (pino). A pretty printer can be added later if wanted.
