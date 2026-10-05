# Frontend

React 19 + React Router 7 (data router) + Tailwind 3.4.17. See ADR 0002 for how the Stitch
design was ported and why Tailwind is pinned.

## Routes

| Route                  | Screen (design/stitch)         | Notes                                        |
| ---------------------- | ------------------------------ | -------------------------------------------- |
| `/`                    | home_command_center            | Dashboard                                    |
| `/swarm`               | swarm_command_center           | Reached from the header "Agents Active"      |
| `/studio`              | ai_studio                      |                                              |
| `/agents`              | ai_team_directory              | Real agents (`GET /api/agents`)              |
| `/agents/new?step=1-5` | create_agent_wizard            | Creates name + role (`POST`)                 |
| `/agents/:agentId`     | nova_profile                   | Real agent, 404 state, delete                |
| `/tasks`               | mission_control                | Real task registry, lifecycle and assignment |
| `/terminal`            | multi_agent_terminal_workspace |                                              |
| `/network`             | agent_network                  |                                              |
| `/onboarding/*`        | onboarding_* (5 steps)         | Own shell; Esc / ←→ / ⌘↵ shortcuts           |
| `/activity`            | home timeline frame            | Real REST/live events                        |
| `/files` etc.          | none                           | Explicit "Not built yet" state               |

## Layout

```
src/
  app/router.tsx            route table
  components/shell/         AppShell, AppHeader, AppSidebar, navigation.ts
  components/onboarding/    OnboardingShell, header/footer, step order
  components/agents/        DirectoryAvatar (per-agent artwork), DeleteAgentButton
  features/agents/          agents-store (list), useAgent (one), presentation (card view)
  features/tasks/           tasks-store (list, pending, mutation/refetch)
  features/terminal/        RealTerminal (xterm), terminal-client (protocol/state)
  lib/                      api.ts (REST client), ws.ts (WebSocket URLs)
  hooks/                    useLinkBehavior (link semantics for non-anchor elements), useNow
  features/activity/        validated stream, bounded page state, human formatter
  mocks/                    agents.tsx (remaining design previews)
  pages/<page>/             page component + its section components + page-local state
  styles/fonts.css          self-hosted Geist, JetBrains Mono, Material Symbols
  assets/fonts/             WOFF2 files
```

Components never touch the filesystem or processes; privileged work will go through the
server API/WebSocket (PR 3+).

## Agents (real data)

The Agents directory, drawer, profile, wizard submit, sidebar badge and header pill use
the agent registry (ADR 0006). Cards keep the design's markup; fields with no backing data
yet show explicit placeholders (`toDirectoryCard` in `features/agents/presentation.ts`).
Name, role and a known provider ID are sent from the wizard. Provider cards and profile
availability use `/api/providers`; unavailable providers are disabled in the wizard.
Other draft controls remain presentation-only.

## Mock data

Home operative previews, Swarm, Studio and Network still render typed design mock data from
`src/mocks/` through reusable operative card components. `tests/unit/mocks.test.ts` validates them against the shared
schemas. Single bespoke widgets and telemetry figures still hold their design text inline.
Search for `TODO(PR` to find every place that switches to real data, and the milestone.

Operative cards on Home and Swarm open `/agents/:id`, which shows the real profile when
that agent is registered and "Agent not found" otherwise.

## Tasks (real data)

Mission Control, its cards, inspector, create form, filters, metrics and sidebar badge
use validated task endpoints (ADR 0012). The task store follows the lightweight Agents
pattern. Actions are explicit; assignments do not start agents. The five original
columns remain; Failed appears when present and is also accessible through a filter. Unsupported priorities,
per-task progress, telemetry and dependency figures are removed. No task demo data
is loaded in production. Page entry and Refresh fetch current tasks and agents;
mutation responses update the board, and conflicts reload the affected task.

## Activity (real data)

`/activity` reuses the existing Home timeline frame with a single human formatter,
All/Agents/Tasks/Messages/System filters, entity links, relative times and ISO tooltips.
The Dashboard shows the latest five matching events. Neither imports activity mocks.
Each mounted page owns one stream; global shell state does not subscribe to events.
The client connects, buffers incoming facts during the REST resnapshot, deduplicates by
ID and retains at most 100 visible events. Five bounded retries and a handshake timeout
lead to explicit Retry; older cursor pages and Latest activity are available on Activity.

Dashboard Team Overview reads supported counts from `/api/activity/summary` with a
short debounce; activity does not pretend to measure productivity, GPU or inference.
UTC-today message counts refer to retained activity history, not lifetime totals.
Home operative cards remain explicitly labeled DESIGN PREVIEW; orchestrator intelligence
and the other existing mock surfaces are deferred. Agent provider startup is real (ADR 0014).

## Task execution and review (PR 15)

The existing task inspector exposes Execute for eligible assigned tasks, Cancel while
active, and real execution state/provider/start time. Bounded polling updates the stored
task and structured summary, reported changed files and notes when it reaches Review.
Complete and Return to Working remain human actions; returning does not start a process.
Provider discovery explicitly gates automation. Controlled failures preserve retryable
assignment; raw provider logs and commands are never sent by the browser. See
[ADR 0015](../adr/0015-real-ai-execution.md). The board and design chrome remain unchanged.
