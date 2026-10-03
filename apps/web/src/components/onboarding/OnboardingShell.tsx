import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { OnboardingFooter } from "./OnboardingFooter";
import { OnboardingHeader } from "./OnboardingHeader";
import { ONBOARDING_STEPS, nextOnboardingPath } from "./steps";

// Mirrors the onboarding screens' <body> classes from the Stitch export.
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Footer shortcuts: Esc skips setup, ←/→ cycle stages, ⌘/Ctrl+↵ commits and advances. */
function useOnboardingShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Read the URL at key time: a closure over the rendered pathname is stale between a
      // navigation and the next render, so quick key presses could skip a step.
      const current = window.location.pathname.replace(/\/+$/, "");
      const index = ONBOARDING_STEPS.findIndex((step) => step.path === current);

      if (event.key === "Escape") {
        navigate("/");
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        navigate(nextOnboardingPath(current));
      } else if (!isTypingTarget(event.target) && index !== -1) {
        const target =
          event.key === "ArrowRight"
            ? ONBOARDING_STEPS[index + 1]
            : event.key === "ArrowLeft"
              ? ONBOARDING_STEPS[index - 1]
              : undefined;
        if (target) navigate(target.path);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}

export function OnboardingShell() {
  useOnboardingShortcuts();
  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary-container">
      <OnboardingHeader />
      <Outlet />
      <OnboardingFooter />
    </div>
  );
}
