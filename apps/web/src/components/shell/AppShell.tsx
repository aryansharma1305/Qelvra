import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

// Mirrors the app screens' <body> classes and fixed header/sidebar layout from the Stitch export.
export function AppShell() {
  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface select-none antialiased min-h-screen">
      <AppHeader />
      <AppSidebar />
      <div className="pl-56">
        <Outlet />
      </div>
    </div>
  );
}
