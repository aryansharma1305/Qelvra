import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ProjectIdSchema, RegisterProjectSchema } from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import type { ProjectRegistry } from "./project-registry.js";
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid project request; no Git arguments or commands are accepted",
    );
  return result.data;
}
export function registerProjectRoutes(app: FastifyInstance, projects: ProjectRegistry) {
  const empty = (value: unknown) => parse(z.strictObject({}), value === undefined ? {} : value);
  app.get("/api/projects", (request) => {
    empty(request.query);
    return projects.list();
  });
  app.post("/api/projects", { bodyLimit: 32768 }, async (request, reply) => {
    empty(request.query);
    const response = await projects.register(parse(RegisterProjectSchema, request.body));
    reply.code(201);
    return response;
  });
  app.get<{ Params: { id: string } }>("/api/projects/:id", (request) => {
    empty(request.query);
    return projects.get(parse(ProjectIdSchema, request.params.id));
  });
  app.post<{ Params: { id: string } }>("/api/projects/:id/refresh", (request) => {
    empty(request.query);
    empty(request.body);
    return projects.refresh(parse(ProjectIdSchema, request.params.id));
  });
  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    empty(request.query);
    empty(request.body);
    await projects.unregister(parse(ProjectIdSchema, request.params.id));
    return reply.code(204).send();
  });
}
