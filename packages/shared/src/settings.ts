import { z } from "zod";

/** Selected effective startup values only; never a process environment dump. */
export const SettingsResponseSchema = z.strictObject({
  general: z.strictObject({
    version: z.string().min(1),
    environment: z.enum(["development", "test", "production"]),
    nodeVersion: z.string().min(1),
    platform: z.string().min(1),
    architecture: z.string().min(1),
  }),
  storage: z.strictObject({
    dataDir: z.string().min(1),
    workspaceRoot: z.string().min(1),
  }),
  network: z.strictObject({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    webOrigins: z.array(z.url({ protocol: /^https?$/ })).min(1),
    loopbackOnly: z.boolean(),
    apiAuthentication: z.literal("not-enabled"),
  }),
  restartRequired: z.literal(true),
});
export const EmptySettingsRequestSchema = z.strictObject({});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;
