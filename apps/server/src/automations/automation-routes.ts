import { z } from "zod";
import {
  AutomationIdSchema,
  AutomationInputSchema,
  AutomationUpdateSchema,
  AutomationMutationSchema,
  AutomationAdmissionSchema,
  AutomationHistoryQuerySchema,
} from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import type { AutomationService } from "./automation-service.js";

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid automation fields, revision or UTC schedule",
    );
  return result.data;
}
export function registerAutomationRoutes(app: FastifyInstance, service: AutomationService) {
  const id = (value: string) => parse(AutomationIdSchema, value);
  app.get("/api/automations", (request, reply) => {
    parse(z.strictObject({}), request.query);
    reply.header("cache-control", "no-store");
    return service.list();
  });
  app.post("/api/automations", async (request, reply) => {
    const result = await service.create(parse(AutomationInputSchema, request.body));
    reply.code(201);
    return result;
  });
  app.get<{ Params: { id: string } }>("/api/automations/:id", (request, reply) => {
    parse(z.strictObject({}), request.query);
    reply.header("cache-control", "no-store");
    return service.get(id(request.params.id));
  });
  app.get<{ Params: { id: string } }>("/api/automations/:id/runs", (request, reply) => {
    const query = parse(AutomationHistoryQuerySchema, request.query);
    reply.header("cache-control", "no-store");
    return service.history(id(request.params.id), query.limit);
  });
  app.put<{ Params: { id: string } }>("/api/automations/:id", (request) => {
    const { revision, ...input } = parse(AutomationUpdateSchema, request.body);
    return service.update(id(request.params.id), revision, input);
  });
  app.delete<{ Params: { id: string } }>("/api/automations/:id", async (request, reply) => {
    const input = parse(AutomationMutationSchema, request.body);
    await service.delete(id(request.params.id), input.revision);
    reply.code(204);
    return null;
  });
  for (const action of ["enable", "disable", "run"] as const) {
    app.post<{ Params: { id: string } }>(`/api/automations/:id/${action}`, (request) => {
      const input = parse(AutomationAdmissionSchema, request.body),
        automationId = id(request.params.id);
      return action === "run"
        ? service.runNow(automationId, input.revision, input.acknowledgeInterruption)
        : service.enabled(
            automationId,
            input.revision,
            action === "enable",
            input.acknowledgeInterruption,
          );
    });
  }
}
