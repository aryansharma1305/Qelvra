import { z } from "zod";
import { AssignTaskRequestSchema, CreateTaskRequestSchema, TaskIdSchema } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import { TaskError } from "./task-errors.js";
import type { TaskRegistry } from "./task-registry.js";

function id(raw: string) {
  if (!TaskIdSchema.safeParse(raw).success)
    throw new AppError(400, "TASK_INVALID_ID", "Task id is invalid");
  return raw;
}
export function registerTaskRoutes(app: FastifyInstance, tasks: TaskRegistry) {
  const controlled = async <T>(operation: () => Promise<T> | T): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof TaskError)) throw error;
      if (error.code === "TASK_PERSISTENCE_FAILED")
        throw new AppError(500, error.code, "Could not save tasks");
      throw new AppError(
        error.code === "TASK_NOT_FOUND"
          ? 404
          : ["TASK_INVALID_TRANSITION", "TASK_ALREADY_ASSIGNED"].includes(error.code)
            ? 409
            : 400,
        error.code,
        error.message,
      );
    }
  };
  app.get("/api/tasks", () => ({ tasks: tasks.list() }));
  app.get<{ Params: { id: string } }>("/api/tasks/:id", (request) =>
    controlled(() => ({ task: tasks.require(id(request.params.id)) })),
  );
  app.post("/api/tasks", async (request, reply) => {
    const input = CreateTaskRequestSchema.safeParse(request.body);
    if (!input.success) {
      const field = input.error.issues[0]?.path[0];
      throw new AppError(
        400,
        field === "title"
          ? "TASK_INVALID_TITLE"
          : field === "description"
            ? "TASK_INVALID_DESCRIPTION"
            : "VALIDATION_ERROR",
        input.error.issues[0]?.message ?? "Invalid task",
      );
    }
    const task = await controlled(() => tasks.create(input.data));
    reply.code(201);
    return { task };
  });
  app.post<{ Params: { id: string } }>("/api/tasks/:id/assign", async (request) => {
    const input = AssignTaskRequestSchema.safeParse(request.body);
    if (!input.success) throw new AppError(400, "VALIDATION_ERROR", "Choose a valid agent");
    return controlled(async () => ({
      task: await tasks.assign(id(request.params.id), input.data.agentId),
    }));
  });
  for (const action of ["start", "review", "complete", "fail"] as const) {
    app.post<{ Params: { id: string } }>(`/api/tasks/:id/${action}`, (request) => {
      if (!z.strictObject({}).safeParse(request.body ?? {}).success)
        throw new AppError(400, "VALIDATION_ERROR", "This action takes no task fields");
      return controlled(async () => ({ task: await tasks[action](id(request.params.id)) }));
    });
  }
}
