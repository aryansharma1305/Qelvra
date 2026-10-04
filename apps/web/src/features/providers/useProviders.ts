import { useEffect, useState } from "react";
import type { Provider } from "@qelvra/shared";
import { listProviders } from "../../lib/api";
let cached: { expires: number; promise: Promise<Provider[]> } | null = null;
export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!cached || cached.expires < Date.now())
      cached = { expires: Date.now() + 60000, promise: listProviders() };
    void cached.promise.then(
      (value) => {
        if (active) {
          setProviders(value);
          setLoading(false);
        }
      },
      () => {
        cached = null;
        if (active) {
          setError("Provider availability could not be loaded. Reload to try again.");
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return { providers, error, loading };
}
export function providerStatus(provider: Provider): string {
  if (provider.reason === "DISABLED_IN_PRODUCTION") return "Disabled in production";
  if (provider.reason === "CLI_NOT_FOUND") return "Not installed";
  if (provider.reason === "DETECTION_FAILED") return "Detection failed";
  if (!provider.configured) return "Model not configured";
  if (provider.auth === "auth-required") return "Sign-in required";
  return provider.auth === "unknown" ? "Installed · authentication unchecked" : "Available";
}
export function canLaunchProvider(provider: Provider) {
  return provider.available && provider.configured && provider.auth !== "auth-required";
}
