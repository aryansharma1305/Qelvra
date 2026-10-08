# Qelvra

Qelvra is a local-first multi-agent AI workspace for creating agents, running them in real terminals, assigning structured tasks, coordinating multi-agent goals and reviewing the work they produce.

**Latest beta: [v0.1.0-beta.1](https://github.com/aryansharma1305/Qelvra/releases/tag/v0.1.0-beta.1)** — the first public beta. The release tag represents the verified beta; `main` may contain newer development fixes.

Instead of manually opening several AI coding sessions and coordinating them yourself, give each agent its own identity, workspace, runtime and mailbox. Qelvra tracks their work through persistent tasks and goal plans so you can inspect results and decide what to accept.

**Agents currently use isolated workspaces. Qelvra does not automatically merge their edits into one shared project repository.**

> Qelvra is intended for one trusted local user. **There is no API authentication. Do not expose Qelvra directly to the public internet or an untrusted LAN.** Keep the default loopback binding.

## What works today

- Persistent agents with isolated filesystem workspaces and real browser terminals backed by PTYs.
- Local provider discovery and real automated execution through an installed, authenticated Codex CLI.
- Persistent tasks: create, assign, execute, review and complete, with structured execution results.
- The Files page browses and edits isolated agent workspaces (v0.2 development on `main`).
- The Memory page edits persistent per-agent Markdown notes (v0.2 development).
- Analytics provides local read-only insights over retained Activity events (v0.2 development).
- Settings shows effective runtime configuration and supports explicit local provider rediscovery (v0.2 development).
- Filesystem mailbox messaging and automatic agent-to-agent routing.
- A real-time Activity feed for agent, task, execution and goal events.
- **Goal → Plan → Run → Review/Rework → Final Summary** orchestration with explicit plan approval.
- Saved state across restarts and recovery that requires inspection and explicit retry/resume for interrupted work.
- A deterministic **Fake agent (development)** provider for testing without an AI account.

Provider discovery covers more CLIs than automated execution does. In this beta, only Codex and the development Fake provider support automated tasks and goals. See the [provider support table](docs/providers.md).

## How Qelvra works

A goal coordinates several agents through an approved plan:

```text
User Goal
    |
Orchestrator
    |
Plan -- you review and choose Run Plan
    |
  Tasks
    +---------------------+
    |                     |
   Nova                  Atlas
    |                     |
Nova workspace       Atlas workspace
    |                     |
    +----------+----------+
               |
       Structured results
               |
        Review / Rework
               |
         Final Summary
```

For a single task:

```text
Task -> Agent -> AI Provider -> Workspace changes
                                  |
                           Structured Result
                                  |
                          Your Review -> Complete
```

The goal summary references each agent's results; files remain in separate workspaces.

## Quick start

Use **Node.js 22** and npm. On macOS/Linux, have Python 3 and your platform's C/C++ build tools available if `node-pty` needs to compile. Windows has not been release-verified. If you use nvm, run `nvm use` before installing.

```sh
git clone https://github.com/aryansharma1305/Qelvra.git
cd Qelvra
npm ci
npm run dev
```

Open [Qelvra on localhost](http://127.0.0.1:5173). The API listens on `127.0.0.1:3001`. Ctrl+C stops both processes. No Qelvra account or credentials are required. Start with the [free Fake-provider demo](#try-it-without-an-ai-provider).

Defaults need no configuration file. To customize them, copy [.env.example](.env.example) to **`apps/server/.env`**; server paths resolve from that workspace. Put `VITE_API_URL` in `apps/web/.env.local` only when changing the API URL, then restart the frontend. See [configuration and storage](docs/architecture.md).

## Try it without an AI provider

**Recommended first test.** The Fake provider uses deterministic fixtures: it does not call an LLM or consume API/provider usage. It demonstrates agent runtimes, task results, routing and orchestration. Its output is a test artifact, not an AI-built application. It is unavailable in production mode.

After cloning the repository, run:

```sh
npm ci
npm run dev
```

In **Agents → Create Agent**, create these three agents, selecting **Fake agent (development)** for each:

| Name          | Role              |
| ------------- | ----------------- |
| Demo Planner  | Orchestrator      |
| Demo Frontend | Frontend Engineer |
| Demo Backend  | Backend Engineer  |

These worker roles match the Fake provider's built-in two-task plan. You do not need to Start their interactive terminals before executing tasks.

**Try a task:**

1. Open **Tasks → Create Task**. Enter a title such as `Test the fake worker` and assign **Demo Frontend**.
2. Open the task details and choose **Execute**.
3. Observe **Working → Review**, then inspect the structured result and its workspace artifact.
4. Choose **Complete** after reviewing it.

**Try a multi-agent goal:**

1. Open **Tasks → Goals → New Goal**. Use the title `Build frontend and backend`, add a short description and choose **Demo Planner** as orchestrator.
2. Choose **Generate Plan** and inspect the two proposed worker tasks.
3. Choose **Run Plan** to approve execution.
4. Watch the worker tasks and **Activity** as results are routed and reviewed.
5. Inspect the **Final goal summary** and its artifact references. The Fake provider approves successful fixture results; it has not built or tested an integrated application.

## Try it with Codex

Real automated AI execution has verified local Codex support in this beta. The **Codex CLI must already be installed and authenticated using Codex's own mechanism**. Qelvra detects it on the server's PATH; it does not install Codex or store its credentials. Provider usage may consume your account quota or credits.

Follow the [provider setup and troubleshooting guide](docs/providers.md). Restart Qelvra after changing PATH, then retry provider discovery if needed.

1. Open **Agents → Create Agent**, enter a name and role, and select **Codex** once it is available and signed in.
2. Create a task, assign that agent and use this harmless first instruction:

   ```text
   Create hello.txt containing exactly HELLO_QELVRA.
   ```

3. Choose **Execute**, wait for **Review** and inspect the structured result.
4. Check the actual file in that agent's isolated workspace, then choose **Complete** if it matches your request.

With default storage, the file is at `apps/server/.qelvra/hive/agents/<agent-id>/workspace/hello.txt`. A reported changed file or successful test is a provider claim: review the files and evidence before accepting the work.

## Your first Agent / Task / Goal

- **Agent:** a saved identity, provider configuration and workspace. Creation saves a stopped agent. **Start** opens its interactive terminal; **Stop** ends that runtime. Interactive Start and automated task **Execute** use separate processes.
- **Task:** a unit of work assigned to an automation-capable agent. Execute produces a structured result and moves successful work to **Review**. For standalone tasks, you inspect the result and choose **Complete** yourself.
- **Goal:** a larger request handled by an orchestrator and suitable worker agents. **Generate Plan** proposes a breakdown; **Run Plan** explicitly approves it. The orchestrator assigns workers, reviews results, requests bounded rework when needed and produces a final summary. Inspect that summary and the underlying files.

The Home draft opens the Goal form; it does not execute work. Choose your orchestrator and configure suitable worker roles before approving a plan.

## Test it yourself

### Level 1 — Basic UI / Fake provider

Follow [Try it without an AI provider](#try-it-without-an-ai-provider). This exercises the application without an external AI dependency. Stop and restart Qelvra, then check that your agents, tasks, goal summary and workspace files remain available.

### Level 2 — Full automated test suite

From the repository root, with dependencies installed:

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

These automated flows use fixtures and disposable data; they do not require paid provider access. Design parity compares against the original Stitch exports and needs network access for their Tailwind CDN. An optional 30-minute fixture soak is available with `npm run release:soak -w @qelvra/server`.

### Level 3 — Real Codex smoke

These local checks require an installed, authenticated Codex CLI and **may consume provider usage**:

```sh
npm run execution:smoke -w @qelvra/server -- codex
npm run orchestration:smoke -w @qelvra/server
```

The first verifies real Codex task execution. The second uses a **real Codex orchestrator with deterministic Fake workers** to check planning, review and summary coordination. It does not verify real AI execution by every worker. Both use disposable data.

## Build and production-like local run

```sh
npm run build
NODE_ENV=production WEB_ORIGIN=http://127.0.0.1:4173 npm run start:server
```

In another terminal, from the repository:

```sh
npm run preview -w @qelvra/web -- --host 127.0.0.1 --port 4173 --strictPort
```

Open [the built web app](http://127.0.0.1:4173). The API still defaults to port 3001. Set `VITE_API_URL` **before building** if using a different API port. The Fake provider is disabled in this mode.

These commands run the built server and web assets locally. The beta is source-run, with no desktop installer, Electron package, npm distribution or hosted deployment.

## Where Qelvra stores data

Default location: **`apps/server/.qelvra/`**.

| Path                                | Contents                            |
| ----------------------------------- | ----------------------------------- |
| `agents.json`                       | Saved agents and configuration      |
| `tasks.json`                        | Tasks and lifecycle state           |
| `executions.json`                   | Execution state and results         |
| `orchestrations.json`               | Goals, plans, reviews and summaries |
| `events.jsonl`                      | Retained Activity history           |
| `hive/agents/<agent-id>/workspace/` | Each agent's files                  |
| `hive/agents/<agent-id>/inbox/`     | Incoming mailbox messages           |
| `hive/agents/<agent-id>/outbox/`    | Outgoing mailbox messages           |
| `hive/system/`, `hive/quarantine/`  | Control and rejected messages       |

Custom `DATA_DIR` changes this location; relative paths resolve from the server workspace. **Stop Qelvra and back up the entire data directory** before upgrading or restoring. Provider credentials remain managed separately by the provider.

Startup checks snapshots and writable directories before recovery writes. Corrupt authoritative state fails with the subsystem and filename; it is not overwritten. Restore a known-good stopped-server backup or repair the named file/permissions. Do not delete state to clear an error.

After a crash, runtimes become stopped, interrupted executions require explicit retry and active goals become paused for inspection/resume. Workspace edits are retained; a crash does not roll them back. Retries may repeat edits, and mailbox delivery is at least once. See [storage limits and recovery](docs/architecture.md#storage).

## Security

**Qelvra is intended for one trusted local user. There is no API authentication. Do not expose Qelvra directly to the public internet or an untrusted LAN.** Keep the default `HOST=127.0.0.1`; a non-local binding requires trusting every caller.

An agent's workspace cwd is **not a full OS sandbox**. Provider processes can have broader machine access, and external providers may send your prompts/code to their services. Read [SECURITY.md](SECURITY.md) before running unfamiliar work or changing network settings.

## Current beta limitations

- Agents use **isolated workspaces**. Qelvra does not automatically merge edits into one shared project repository. Shared Projects / Git Worktree Collaboration is future work.
- The beta assumes a trusted local machine and one user. It has **no API authentication** and is unsafe to expose directly to the public internet or an untrusted LAN.
- Provider installation, authentication and account usage remain provider-owned. Detection alone does not mean a provider supports automation.
- Studio, Network, Swarm and the older onboarding tour are visual previews. Some controls are informational or disabled; Attachments, Voice, Vector Memory, per-agent autonomous Delegation and Lo-Fi playback are not available in beta.
- Windows is not release-verified. The UI is desktop-first, and the release runs from source.
- Persistence formats and retention limits are beta constraints; back up before upgrading. Recovery does not guarantee exactly-once messaging or transactional rollback of workspace edits.

See [the full beta limitations](docs/limitations.md) for platform, storage and provider boundaries.

## Project status

Current release: **`v0.1.0-beta.1`**, the first public beta. Feature development is frozen for the first beta cycle; the release line is focused on bug reports, user testing, fixes and stabilization.

The next major planned architecture is **Shared Projects / Git Worktree Collaboration**: agents working in branches/worktrees of one project repository, followed by review and merge. It is reserved for a future release, with no promised release date.

## Architecture and documentation

The React/Vite frontend talks to Fastify over HTTP and WebSocket. Shared Zod contracts validate API and persisted state; the backend manages filesystem registries, PTYs, messaging, execution and orchestration.

- [Architecture, configuration, storage and recovery](docs/architecture.md)
- [Provider support and setup](docs/providers.md)
- [Beta limitations](docs/limitations.md) and [security guidance](SECURITY.md)
- [Release notes](docs/release/v0.1.0-beta.1.md) and [changelog](CHANGELOG.md)
- [Release checklist](docs/release/v0.1-beta-checklist.md) and [beta verification report](docs/verification/pr17-release-hardening.md)

## Contributing

Use the first beta cycle to report bugs and improve reliability. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contribution guidance. Include reproduction steps, platform/provider versions and relevant controlled errors; keep credentials and private workspace content out of reports.

## License

Qelvra is licensed under [Apache-2.0](LICENSE), Copyright 2026 Aryan Sharma and Qelvra contributors. Third-party materials retain their original terms; see [NOTICE](NOTICE) and [third-party notices and distribution audit](THIRD_PARTY_NOTICES.md).
