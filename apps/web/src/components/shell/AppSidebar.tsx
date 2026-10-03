import { NavLink } from "react-router";
import { ConnectionStatus } from "./ConnectionStatus";
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
        <span className="font-body-sm text-body-sm">{item.label}</span>
      </div>
      {item.badge && (
        <span className={`font-label-sm text-label-sm px-1.5 py-0.2 ${item.badge.className}`}>
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
  // The Agents badge shows the real number of registered agents once loaded.
  const items = NAV_ITEMS.map((item): NavItem => {
    if (item.path !== "/agents" || !item.badge) return item;
    if (status !== "ready") return { label: item.label, path: item.path, icon: item.icon };
    return { ...item, badge: { ...item.badge, label: String(agents.length) } };
  });

  return (
    <aside className="fixed left-0 top-12 bottom-0 w-56 bg-surface-container-lowest border-r border-outline-variant/30 z-40 flex flex-col justify-between pt-3 pb-3">
      <div className="flex flex-col gap-1 px-2">
        <div className="px-2.5 pb-2 text-outline font-label-sm text-label-sm uppercase tracking-wider">
          Workspace Nodes
        </div>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </nav>
      </div>
      <div className="px-3 pt-3 border-t border-outline-variant/30 flex flex-col gap-2 bg-surface-container-lowest">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
          <span className="uppercase tracking-wider">Node Cluster</span>
          <ConnectionStatus />
        </div>
        <div className="bg-surface-container-low p-2 rounded border border-outline-variant/30 flex flex-col gap-1.5">
          <div className="flex justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant">GPU Load</span>
            <span className="text-secondary font-medium">42%</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-secondary w-[42%]" />
          </div>
          <div className="flex justify-between font-code-sm text-code-sm pt-0.5">
            <span className="text-on-surface-variant">VRAM</span>
            <span className="text-on-surface font-medium">18.4 / 24 GB</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary-container w-[76%]" />
          </div>
        </div>
        <div className="flex items-center justify-between text-outline font-label-sm text-label-sm px-0.5">
          <span>Latency: 14ms</span>
          <span>vLLM 0.6.3</span>
        </div>
      </div>
    </aside>
  );
}
