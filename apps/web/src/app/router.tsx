import { RouteError } from "./RouteError";
import { createBrowserRouter } from "react-router";
import { OnboardingShell } from "../components/onboarding/OnboardingShell";
import { AppShell } from "../components/shell/AppShell";
import { EmptyStatePage } from "../pages/EmptyStatePage";

// Pages are code-split per route; the data router resolves the module before rendering,
// so navigation shows no loading flash.
const undesigned = [
  {
    path: "automations",
    title: "Automations",
    icon: "account_tree",
    description: "Scheduled and triggered agent workflows will live here.",
  },
];

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    // Initial routes are lazy; render nothing until the page module resolves.
    HydrateFallback: () => null,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("../pages/home/HomePage")).HomePage }),
      },
      {
        path: "swarm",
        lazy: async () => ({ Component: (await import("../pages/swarm/SwarmPage")).SwarmPage }),
      },
      {
        path: "studio",
        lazy: async () => ({
          Component: (await import("../pages/studio/StudioPage")).StudioPage,
        }),
      },
      {
        path: "agents",
        lazy: async () => ({
          Component: (await import("../pages/agents/AgentsPage")).AgentsPage,
        }),
      },
      {
        path: "agents/new",
        lazy: async () => ({
          Component: (await import("../pages/create-agent/CreateAgentPage")).CreateAgentPage,
        }),
      },
      {
        path: "agents/:agentId",
        lazy: async () => ({
          Component: (await import("../pages/agent-detail/AgentDetailRoute")).AgentDetailRoute,
        }),
      },
      {
        path: "tasks",
        lazy: async () => ({ Component: (await import("../pages/tasks/TasksPage")).TasksPage }),
      },
      {
        path: "files",
        lazy: async () => ({ Component: (await import("../pages/files/FilesPage")).FilesPage }),
      },
      {
        path: "memory",
        lazy: async () => ({ Component: (await import("../pages/memory/MemoryPage")).MemoryPage }),
      },
      {
        path: "terminal",
        lazy: async () => ({
          Component: (await import("../pages/terminal/TerminalPage")).TerminalPage,
        }),
      },
      {
        path: "network",
        lazy: async () => ({
          Component: (await import("../pages/network/NetworkPage")).NetworkPage,
        }),
      },
      {
        path: "analytics",
        lazy: async () => ({
          Component: (await import("../pages/analytics/AnalyticsPage")).AnalyticsPage,
        }),
      },
      {
        path: "settings",
        lazy: async () => ({
          Component: (await import("../pages/settings/SettingsPage")).SettingsPage,
        }),
      },
      {
        path: "activity",
        lazy: async () => ({
          Component: (await import("../pages/activity/ActivityPage")).ActivityPage,
        }),
      },
      ...undesigned.map(({ path, ...props }) => ({ path, element: <EmptyStatePage {...props} /> })),
      {
        path: "*",
        element: (
          <EmptyStatePage
            title="Not found"
            icon="explore_off"
            description="This page does not exist. Use the sidebar to get back to the workspace."
          />
        ),
      },
    ],
  },
  {
    path: "onboarding",
    element: <OnboardingShell />,
    errorElement: <RouteError />,
    HydrateFallback: () => null,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("../pages/onboarding/BuildTeamStep")).BuildTeamStep,
        }),
      },
      {
        path: "goal",
        lazy: async () => ({ Component: (await import("../pages/onboarding/GoalStep")).GoalStep }),
      },
      {
        path: "team",
        lazy: async () => ({
          Component: (await import("../pages/onboarding/FirstTeamStep")).FirstTeamStep,
        }),
      },
      {
        path: "engines",
        lazy: async () => ({
          Component: (await import("../pages/onboarding/EnginesStep")).EnginesStep,
        }),
      },
      {
        path: "ready",
        lazy: async () => ({
          Component: (await import("../pages/onboarding/ReadyStep")).ReadyStep,
        }),
      },
    ],
  },
]);
