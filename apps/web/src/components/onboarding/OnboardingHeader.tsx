// Ported from the Stitch export (agent_hive_onboarding_build_your_ai_team/code.html). Keep visually identical to the design.
import { NavLink } from "react-router";
import { ONBOARDING_STEPS } from "./steps";

const ACTIVE_STEP_CLASSES =
  "flex items-center gap-space-xs px-space-md py-1 rounded-full transition-colors bg-surface-container-highest text-on-surface ring-1 ring-primary/40 font-medium";
const INACTIVE_STEP_CLASSES =
  "flex items-center gap-space-xs px-space-md py-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors font-body-sm text-body-sm";

export function OnboardingHeader() {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 w-full px-gutter-lg flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <img
            alt="Qelvra Brand Mark"
            className="h-8 w-auto object-contain"
            src="/artwork/qelvra-mark.svg"
          />
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
              Qelvra
            </span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container text-secondary font-label-sm text-label-sm uppercase tracking-wider">
              Setup
            </span>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-space-xs bg-surface-container-lowest p-space-xs rounded-full shadow-inner">
          {ONBOARDING_STEPS.map((step) => (
            <NavLink
              key={step.path}
              to={step.path}
              end
              className={({ isActive }) => (isActive ? ACTIVE_STEP_CLASSES : INACTIVE_STEP_CLASSES)}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${step.dotClass}`} />
              <span>{step.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-space-lg">
          <a
            className="text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm flex items-center gap-space-xs transition-colors"
            href="https://github.com/aryansharma1305/Qelvra#quick-start"
          >
            <span className="material-symbols-outlined text-[16px]">help</span>
            <span>Assistance</span>
          </a>
          <div className="h-4 w-px bg-surface-variant hidden sm:block" />
          <img
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover ring-1 ring-surface-variant"
            src="/artwork/avatar-user.svg"
          />
        </div>
      </div>
    </header>
  );
}
