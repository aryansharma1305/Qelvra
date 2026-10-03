import type { HealthResponse } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance, version: string): void {
  app.get("/api/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    version,
    timestamp: new Date().toISOString(),
  }));
}
