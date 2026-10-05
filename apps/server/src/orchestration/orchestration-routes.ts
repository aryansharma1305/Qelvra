import { z } from "zod";
import { CreateOrchestrationRequestSchema, GoalIdSchema } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import { OrchestrationError } from "./orchestration-errors.js";
import type { OrchestrationService } from "./orchestration-service.js";
export function registerOrchestrationRoutes(app: FastifyInstance, service: OrchestrationService) {
  const controlled = async <T>(operation: () => Promise<T> | T) => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OrchestrationError)
        throw new AppError(
          error.code === "ORCHESTRATION_NOT_FOUND"
            ? 404
            : error.code === "ORCHESTRATION_PERSISTENCE_FAILED"
              ? 500
              : 409,
          error.code,
          error.message,
        );
      throw new AppError(
        500,
        "ORCHESTRATION_PERSISTENCE_FAILED",
        "Goal action failed. Check server storage.",
      );
    }
  };
  app.get("/api/orchestrations", () => ({ orchestrations: service.list() }));
  app.post("/api/orchestrations", async (request, reply) => {
    const input = CreateOrchestrationRequestSchema.safeParse(request.body);
    if (!input.success)
      throw new AppError(400, "VALIDATION_ERROR", "Enter a valid goal and orchestrator agent.");
    const orchestration = await controlled(() => service.create(input.data));
    reply.code(201);
    return { orchestration };
  });
  app.get<{ Params: { id: string } }>("/api/orchestrations/:id", (request) =>
    controlled(() => ({ orchestration: service.get(request.params.id) })),
  );
  for (const action of ["plan", "run", "start", "cancel", "resume"] as const)
    app.post<{ Params: { id: string } }>(
      `/api/orchestrations/:id/${action}`,
      async (request, reply) => {
        if (
          !GoalIdSchema.safeParse(request.params.id).success ||
          !z.strictObject({}).safeParse(request.body ?? {}).success
        )
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Goal actions take no commands, paths, plan or provider arguments.",
          );
        const orchestration = await controlled(() =>
          service[action === "start" ? "run" : action](request.params.id),
        );
        if (action !== "cancel") reply.code(202);
        return { orchestration };
      },
    );
}
