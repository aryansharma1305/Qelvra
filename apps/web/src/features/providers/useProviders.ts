import { useEffect, useState } from "react";
import type { Provider } from "@qelvra/shared";
import { listProviders } from "../../lib/api";
let cached: { expires: number; promise: Promise<Provider[]> } | null = null;
export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const retry = () => {
    cached = null;
    setError(null);
    setLoading(true);
    setGeneration((g) => g + 1);
  };
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
          setError("Provider availability could not be loaded. Retry without losing your draft.");
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [generation]);
  return { providers, error, loading, retry };
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

export function providerGuidance(provider: Provider): string {
  if (provider.id === "shell")
    return "Interactive terminal only. Choose an automation provider for tasks and goals.";
  if (provider.id === "fake") return "Development/test fixture only; disabled in production.";
  if (provider.id === "ollama")
    return provider.available
      ? "Ollama is detected, but model selection is not available in Qelvra yet. Choose another provider for execution."
      : "Install Ollama using its official setup instructions. Qelvra model selection is coming later.";
  if (!provider.available)
    return `Install ${provider.name} using its official setup instructions, then retry.`;
  if (provider.auth === "auth-required")
    return `Sign in using the ${provider.name} CLI, then retry.`;
  return provider.capabilities.automation
    ? "Uses your CLI login and permissions. Supports tasks and goals."
    : "Interactive terminal only; automated tasks are coming later.";
}
