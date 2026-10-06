import { NavLink } from "react-router";
import { ConnectionStatus } from "./ConnectionStatus";
import { useTasks } from "../../features/tasks/tasks-store";
import { useAgents } from "../../features/agents/agents-store";
import { NAV_ITEMS, type NavItem } from "./navigation";

const ITEM_BASE = "flex items-center justify-between px-2.5 py-1.5 rounded";
const ITEM_ACTIVE = `${ITEM_BASE} transition-colors bg-primary-container text-on-primary-container font-medium shadow-[0_0_12px_rgba(160,120,255,0.2)]`;
const ITEM_INACTIVE = `${ITEM_BASE} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors`;

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) => (isActive ? ITEM_ACTIVE : ITEM_INACTIVE)}
    >
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
        <span className="sr-only lg:not-sr-only font-body-sm text-body-sm">{item.label}</span>
      </div>
      {item.badge && (
        <span
          className={`hidden lg:block font-label-sm text-label-sm px-1.5 py-0.2 ${item.badge.className}`}
        >
          {item.badge.label}
        </span>
      )}
      {item.pulseDotClass && (
        <span className={`w-1.5 h-1.5 rounded-full ${item.pulseDotClass} animate-pulse`} />
      )}
    </NavLink>
  );
}

// Ported from the Stitch sidebar. The status reflects GET /api/health; the GPU/VRAM
// figures are design mock data until hardware telemetry exists.
export function AppSidebar() {
  const { agents, status } = useAgents();
  const tasks = useTasks();
  // The Agents badge shows the real number of registered agents once loaded.
  const items = NAV_ITEMS.map((item): NavItem => {
    if (!item.badge) return item;
    if (item.path === "/tasks") {
      return {
        ...item,
        badge: { ...item.badge, label: tasks.status === "ready" ? String(tasks.tasks.length) : "" },
      };
    }
    if (item.path !== "/agents") return item;
    if (status !== "ready") return { label: item.label, path: item.path, icon: item.icon };
    return { ...item, badge: { ...item.badge, label: String(agents.length) } };
  });

  return (
    <aside className="fixed left-0 top-12 bottom-0 w-14 lg:w-56 bg-surface-container-lowest border-r border-outline-variant/30 z-40 flex flex-col justify-between pt-3 pb-3">
      <div className="flex flex-col gap-1 px-2">
        <div className="hidden lg:block px-2.5 pb-2 text-outline font-label-sm text-label-sm uppercase tracking-wider">
          Workspace Nodes
        </div>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </nav>
      </div>
      <div className="hidden lg:flex px-3 pt-3 border-t border-outline-variant/30 flex flex-col gap-2 bg-surface-container-lowest">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
          <span className="uppercase tracking-wider">Node Cluster</span>
          <ConnectionStatus />
        </div>
        <div className="bg-surface-container-low p-2 rounded border border-outline-variant/30 flex flex-col gap-1.5">
          <div className="flex justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant">GPU Load</span>
            <span className="text-secondary font-medium">Not measured</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-secondary w-0" />
          </div>
          <div className="flex justify-between font-code-sm text-code-sm pt-0.5">
            <span className="text-on-surface-variant">VRAM</span>
            <span className="text-on-surface font-medium">Not measured</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary-container w-0" />
          </div>
        </div>
        <div className="flex items-center justify-between text-outline font-label-sm text-label-sm px-0.5">
          <span>Latency: —</span>
          <span>Local beta</span>
        </div>
      </div>
    </aside>
  );
}
