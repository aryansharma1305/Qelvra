export interface OnboardingStep {
  label: string;
  path: string;
  /** Dot colour is fixed per step in the design, independent of the active step. */
  dotClass: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { label: "Identity", path: "/onboarding", dotClass: "bg-secondary" },
  { label: "Runtime", path: "/onboarding/goal", dotClass: "bg-outline-variant" },
  { label: "Models", path: "/onboarding/team", dotClass: "bg-outline-variant" },
  { label: "Memory", path: "/onboarding/engines", dotClass: "bg-outline-variant" },
  { label: "Verify", path: "/onboarding/ready", dotClass: "bg-outline-variant" },
];

/** Where "continue" goes from each step; the last step enters the workspace. */
export function nextOnboardingPath(currentPath: string): string {
  const index = ONBOARDING_STEPS.findIndex((step) => step.path === currentPath);
  const next = ONBOARDING_STEPS[index + 1];
  return index === -1 || !next ? "/" : next.path;
}

export function previousOnboardingPath(currentPath: string): string | null {
  const index = ONBOARDING_STEPS.findIndex((step) => step.path === currentPath);
  return index > 0 ? (ONBOARDING_STEPS[index - 1]?.path ?? null) : null;
}
