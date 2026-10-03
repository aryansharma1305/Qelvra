# Frontend

React 19 + React Router 7 (data router) + Tailwind 3.4.17. See ADR 0002 for how the Stitch
design was ported and why Tailwind is pinned.

## Routes

| Route                  | Screen (design/stitch)         | Notes                                   |
| ---------------------- | ------------------------------ | --------------------------------------- |
| `/`                    | home_command_center            | Dashboard                               |
| `/swarm`               | swarm_command_center           | Reached from the header "Agents Active" |
| `/studio`              | ai_studio                      |                                         |
| `/agents`              | ai_team_directory              | Real agents (`GET /api/agents`)         |
| `/agents/new?step=1-5` | create_agent_wizard            | Creates name + role (`POST`)            |
| `/agents/:agentId`     | nova_profile                   | Real agent, 404 state, delete           |
| `/tasks`               | mission_control                |                                         |
| `/terminal`            | multi_agent_terminal_workspace |                                         |
| `/network`             | agent_network                  |                                         |
| `/onboarding/*`        | onboarding_* (5 steps)         | Own shell; Esc / ←→ / ⌘↵ shortcuts      |
| `/activity` etc.       | none                           | Explicit "Not built yet" state          |

## Layout

```
src/
  app/router.tsx            route table
  components/shell/         AppShell, AppHeader, AppSidebar, navigation.ts
  components/onboarding/    OnboardingShell, header/footer, step order
  components/agents/        DirectoryAvatar (per-agent artwork), DeleteAgentButton
  features/agents/          agents-store (list), useAgent (one), presentation (card view)
  features/terminal/        RealTerminal (xterm), terminal-client (protocol/state)
  lib/                      api.ts (REST client), ws.ts (WebSocket URLs)
  hooks/                    useLinkBehavior (link semantics for non-anchor elements), useNow
  mocks/                    agents.tsx, tasks.tsx, activity.tsx (typed design mock data)
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
Only name and role are sent from the wizard. The other steps are presentation-only.

## Mock data

Home, Swarm, Studio, Network, Tasks and Activity still render typed design mock data from
`src/mocks/` through reusable components (`OperativeCard`, `SwarmOperativeCard`,
`TaskCards`, `ActivityItem`). `tests/unit/mocks.test.ts` validates them against the shared
schemas. Single bespoke widgets and telemetry figures still hold their design text inline.
Search for `TODO(PR` to find every place that switches to real data, and the milestone.

Operative cards on Home and Swarm open `/agents/:id`, which shows the real profile when
that agent is registered and "Agent not found" otherwise.
