# Qelvra

Qelvra is a local workspace for running AI agents, inspecting their terminals, assigning tasks and coordinating goals through plans, review and rework. Version `0.1.0-beta.1` is a **release candidate**; see the [release checklist](docs/release/v0.1-beta-checklist.md) before publishing it.

Agents currently operate in isolated workspaces. Qelvra coordinates their tasks and results but does not yet automatically merge edits into one shared project repository.

## Quick start

Use **Node.js 22** and npm. On macOS/Linux, have Python 3 and your platform's C/C++ build tools available if `node-pty` needs to compile. Windows has not been release-verified. A provider CLI is optional for exploring the UI, but real automated work requires a compatible, signed-in Codex installation.

```sh
git clone https://github.com/aryansharma1305/Qelvra.git
cd Qelvra
npm ci
npm run dev
```

Open [Qelvra on localhost](http://127.0.0.1:5173). The API listens on `127.0.0.1:3001`. Ctrl+C stops both processes. No cloud account or Qelvra credentials are required. If you use nvm, run `nvm use` before installing.

No configuration file is needed for defaults. For customization, copy `.env.example` to **`apps/server/.env`**. Server paths resolve from that workspace. Put `VITE_API_URL` in `apps/web/.env.local` only when changing the API URL; restart the frontend after changes. See [configuration and storage](docs/architecture.md).

## Your first work

1. **Agents → Create Agent.** Enter a name and role, choose a detected provider, then Create Agent. Creation saves a stopped agent and its workspace. Start opens its interactive terminal; Stop ends that runtime. A running terminal and an automated Execution are separate processes.
2. **Tasks → Create Task.** Enter the task and assign an automation-capable agent. Inspect it and choose **Execute**. A successful Execution supplies a structured result and moves the task to Review. Inspect changed-file claims and tests, then choose Complete yourself.
3. **Tasks → Goals → New Goal.** Choose an automation-capable orchestrator. Generate Plan, inspect its task breakdown, then explicitly choose Run Plan. The orchestrator assigns workers, reviews their results, requests bounded rework if needed and produces a final summary. Configure suitable worker roles before running.

The Home draft opens the Goal form; it does not execute work. Studio, Network, Swarm and the older onboarding tour are marked visual previews. Hardware/context telemetry and terminal steering are coming later. Real activity, tasks, agents, terminals, executions and goals use server data.

For a cost-free development demonstration, choose **Fake agent (development)**. It returns deterministic fixture results and is not AI. It is disabled under `NODE_ENV=production`. See [providers](docs/providers.md) for support levels, installation/login guidance and controlled errors.

## Build and production-like local run

```sh
npm run build
NODE_ENV=production WEB_ORIGIN=http://127.0.0.1:4173 npm run start:server
```

In another terminal, from the repository:

```sh
npm run preview -w @qelvra/web -- --host 127.0.0.1 --port 4173 --strictPort
```

Open [the built web app](http://127.0.0.1:4173). The default frontend build targets API port 3001. Set `VITE_API_URL` **before building** if using a different API port. These commands run the built server and web assets locally; there is no installer, Electron package, npm publishing or hosted deployment.

## Data, recovery and security

Defaults store data in **`apps/server/.qelvra/`**: `agents.json`, `tasks.json`, `executions.json`, `orchestrations.json`, `events.jsonl`, and `hive/` workspaces/mailboxes/quarantine. Custom `DATA_DIR` changes that location. Stop the server before copying the **entire directory** for backup, and before restoring it. Keep provider credentials with the provider's own backup policy; Qelvra does not manage them.

Startup checks all snapshots and writable directories before recovery writes. Corrupt authoritative state fails with the subsystem and filename; it is not overwritten. Restore a known-good stopped-server backup or repair the named file/permissions. Do not delete state to clear an error. After a crash, runtimes become stopped, interrupted executions require explicit retry and active goals become paused for inspection/resume. Workspace edits are retained; a crash is not a transaction rollback.

Qelvra assumes one trusted local user. Keep the default loopback binding. **There is no API authentication. Do not expose it to the internet or an untrusted LAN.** Configuring a non-local `HOST` requires trusting every caller. A workspace cwd is **not a full OS sandbox**. External providers may send your prompts/code to their services. Read [SECURITY.md](SECURITY.md) and [beta limitations](docs/limitations.md).

## Tests and contributions

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
CI=1 npm run test:e2e -- --workers=1 --retries=0
npm run test:design
npm run test:release -- --workers=1 --retries=0
npm run production:smoke
npm run release:smoke
```

Design parity uses the original Stitch exports and needs network access for their Tailwind CDN. All destructive test flows use disposable data. Paid/native-provider checks are local-only: `npm run execution:smoke -w @qelvra/server -- codex` and `npm run orchestration:smoke -w @qelvra/server`; these use the installed provider's account and may consume usage. A 30-minute fixture soak is available with `npm run release:soak -w @qelvra/server`.

The React/Vite frontend talks to Fastify; shared Zod contracts validate API and persisted state. Filesystem registries, PTY/runtime managers, mailbox/router, execution and orchestration form the backend. See [architecture](docs/architecture.md), [CONTRIBUTING.md](CONTRIBUTING.md), [changelog](CHANGELOG.md) and [release notes](docs/release/v0.1.0-beta.1.md).

The repository's license is awaiting its owner's decision. Public beta publication is blocked until that decision is recorded.
