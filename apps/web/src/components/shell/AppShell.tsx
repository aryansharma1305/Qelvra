import { Outlet, useLocation } from "react-router";
import { PreviewNotice } from "../PreviewNotice";
import { useServerHealth } from "../../hooks/useServerHealth";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

// Mirrors the app screens' <body> classes and fixed header/sidebar layout from the Stitch export.
export function AppShell() {
  const { pathname } = useLocation();
  const connection = useServerHealth();
  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface select-none antialiased min-h-screen">
      <AppHeader />
      <AppSidebar />
      {["/studio", "/swarm"].includes(pathname) && <PreviewNotice />}
      {connection.state === "disconnected" && (
        <p
          role="alert"
          className="fixed bottom-4 left-16 lg:left-60 right-4 z-50 bg-error-container text-on-error-container p-3 rounded-lg"
        >
          Backend disconnected. Displayed records are last known state; live runtime status is
          unavailable. Restart Qelvra to reconnect.
        </p>
      )}
      <div className="pl-14 lg:pl-56">
        <Outlet />
      </div>
    </div>
  );
}
