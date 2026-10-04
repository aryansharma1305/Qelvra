import { z } from "zod";
export const PROVIDER_IDS = [
  "shell",
  "fake",
  "ollama",
  "codex",
  "gemini",
  "claude-code",
  "opencode",
] as const;
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;
export const ProviderSchema = z.strictObject({
  id: ProviderIdSchema,
  name: z.string().min(1).max(80),
  kind: z.enum(["cli", "shell", "fake"]),
  capabilities: z.strictObject({
    interactive: z.boolean(),
    local: z.boolean(),
    requiresAuth: z.boolean(),
    supportsWorkspace: z.boolean(),
  }),
  available: z.boolean(),
  version: z.string().max(64).nullable(),
  reason: z
    .enum([
      "CLI_NOT_FOUND",
      "DETECTION_FAILED",
      "AUTH_REQUIRED",
      "CONFIGURATION_REQUIRED",
      "DISABLED_IN_PRODUCTION",
    ])
    .nullable(),
  auth: z.enum(["authenticated", "auth-required", "unknown", "not-required"]),
  configured: z.boolean(),
});
export type Provider = z.infer<typeof ProviderSchema>;
export const ProviderListResponseSchema = z.strictObject({ providers: z.array(ProviderSchema) });
