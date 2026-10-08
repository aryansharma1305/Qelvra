import {
  EmptySettingsRequestSchema,
  ProviderListResponseSchema,
  SettingsResponseSchema,
  type SettingsResponse,
} from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { isLoopbackHost, type ServerConfig } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export function settingsSnapshot(config: ServerConfig, version: string): SettingsResponse {
  return SettingsResponseSchema.parse({
    general: {
      version,
      environment: config.environment,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    storage: { dataDir: config.dataDir, workspaceRoot: config.workspaceRoot },
    network: {
      host: config.host,
      port: config.port,
      webOrigins: [...config.webOrigins],
      loopbackOnly: isLoopbackHost(config.host),
      apiAuthentication: "not-enabled",
    },
    restartRequired: true,
  });
}

function empty(value: unknown) {
  if (!EmptySettingsRequestSchema.safeParse(value).success)
    throw new AppError(400, "BAD_REQUEST", "This action does not accept settings or options");
}

export function registerSettingsRoutes(
  app: FastifyInstance,
  config: ServerConfig,
  version: string,
) {
  // Capture selected startup values; subsequent caller mutations cannot rewrite effective state.
  const startup = structuredClone(config);
  app.get("/api/settings", async (request) => {
    empty(request.query);
    const address = app.server.address();
    return settingsSnapshot(
      { ...startup, port: address && typeof address === "object" ? address.port : startup.port },
      version,
    );
  });
  app.post("/api/providers/refresh", async (request) => {
    empty(request.query);
    empty(request.body === undefined ? {} : request.body);
    try {
      return ProviderListResponseSchema.parse({ providers: await app.providers.refresh() });
    } catch {
      // No raw probe error/output, credentials or environment reaches the response or logs.
      throw new AppError(
        503,
        "PROVIDER_DETECTION_FAILED",
        "Provider discovery could not finish. Retry refresh.",
      );
    }
  });
}
