import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { nextOnboardingPath, previousOnboardingPath } from "./steps";

export function useOnboardingNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = pathname.replace(/\/+$/, "") || "/";

  const goNext = useCallback(() => navigate(nextOnboardingPath(current)), [navigate, current]);
  const goBack = useCallback(() => {
    const previous = previousOnboardingPath(current);
    if (previous) navigate(previous);
  }, [navigate, current]);
  const skip = useCallback(() => navigate("/"), [navigate]);

  return { goNext, goBack, skip, hasPrevious: previousOnboardingPath(current) !== null };
}
