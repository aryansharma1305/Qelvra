import type { FastifyInstance } from "fastify";
import { AnalyticsQuerySchema } from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import type { AnalyticsService } from "./analytics-service.js";
export function registerAnalyticsRoutes(app: FastifyInstance, service: AnalyticsService) {
  app.get("/api/analytics", async (request) => {
    const query = AnalyticsQuerySchema.safeParse(request.query);
    if (!query.success)
      throw new AppError(400, "ANALYTICS_INVALID_QUERY", "Invalid analytics filters");
    return service.get(query.data);
  });
}
