export interface NavBadge {
  label: string;
  className: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: NavBadge;
  /** Small pulsing status dot shown instead of a text badge. */
  pulseDotClass?: string;
}

// Order, icons and badge styles follow the Stitch sidebar (agent_network / swarm screens).
// The Agents badge count comes from the agent registry (see AppSidebar).
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", path: "/", icon: "dashboard" },
  {
    label: "AI Studio",
    path: "/studio",
    icon: "view_in_ar",
    badge: { label: "Preview", className: "bg-secondary/20 text-secondary rounded" },
  },
  {
    label: "Agents",
    path: "/agents",
    icon: "smart_toy",
    badge: {
      label: "",
      className: "bg-secondary-container/30 text-secondary border border-secondary/20 rounded",
    },
  },
  {
    label: "Tasks",
    path: "/tasks",
    icon: "task_alt",
    badge: { label: "", className: "bg-surface-container-high text-on-surface-variant rounded" },
  },
  { label: "Terminal", path: "/terminal", icon: "terminal" },
  {
    label: "Agent Network",
    path: "/network",
    icon: "hub",
  },
  { label: "Activity", path: "/activity", icon: "pulse_alert" },
  { label: "Files", path: "/files", icon: "folder_open" },
  { label: "Memory", path: "/memory", icon: "database" },
  { label: "Automations", path: "/automations", icon: "account_tree" },
  { label: "Analytics", path: "/analytics", icon: "query_stats" },
  { label: "Settings", path: "/settings", icon: "tune" },
];
