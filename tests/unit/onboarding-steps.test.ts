import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  nextOnboardingPath,
  previousOnboardingPath,
} from "../../apps/web/src/components/onboarding/steps";

describe("onboarding step order", () => {
  it("follows the order shown in the setup header", () => {
    expect(ONBOARDING_STEPS.map((step) => step.label)).toEqual([
      "Identity",
      "Runtime",
      "Models",
      "Memory",
      "Verify",
    ]);
  });

  it("advances through each step and finally enters the workspace", () => {
    expect(nextOnboardingPath("/onboarding")).toBe("/onboarding/goal");
    expect(nextOnboardingPath("/onboarding/engines")).toBe("/onboarding/ready");
    expect(nextOnboardingPath("/onboarding/ready")).toBe("/");
  });

  it("goes back one step and stops at the first", () => {
    expect(previousOnboardingPath("/onboarding/goal")).toBe("/onboarding");
    expect(previousOnboardingPath("/onboarding")).toBeNull();
  });

  it("treats unknown paths as outside onboarding", () => {
    expect(nextOnboardingPath("/somewhere")).toBe("/");
    expect(previousOnboardingPath("/somewhere")).toBeNull();
  });
});
