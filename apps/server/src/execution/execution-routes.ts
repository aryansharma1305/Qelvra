import { z } from "zod";
import { TaskIdSchema, type ApiErrorCode } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import { AgentError } from "../agents/index.js";
import { ProviderError } from "../providers/provider-errors.js";
import { TaskError } from "../tasks/task-errors.js";
import { ExecutionError } from "./execution-errors.js";
import type { AgentExecutionService } from "./agent-execution-service.js";

export function registerExecutionRoutes(app: FastifyInstance, execution: AgentExecutionService) {
  const controlled = async <T>(taskId: string, body: unknown, action: () => Promise<T> | T) => {
    if (!TaskIdSchema.safeParse(taskId).success)
      throw new AppError(400, "TASK_INVALID_ID", "Task id is invalid");
    if (body !== undefined && !z.strictObject({}).safeParse(body).success)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Execution actions take no command, args, cwd or task fields",
      );
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof ExecutionError ||
        error instanceof ProviderError ||
        error instanceof TaskError ||
        error instanceof AgentError
      )
        throw new AppError(
          error.code === "TASK_NOT_FOUND" || error.code === "AGENT_NOT_FOUND"
            ? 404
            : error.code === "EXECUTION_PERSISTENCE_FAILED"
              ? 500
              : 409,
          error.code as ApiErrorCode,
          error.message,
        );
      throw new AppError(
        500,
        "EXECUTION_START_FAILED",
        "Execution could not start. Check server storage and provider availability.",
      );
    }
  };
  app.get<{ Params: { id: string } }>("/api/tasks/:id/execution", (request) =>
    controlled(request.params.id, undefined, () => execution.get(request.params.id)),
  );
  app.post<{ Params: { id: string } }>("/api/tasks/:id/execute", async (request, reply) => {
    const result = await controlled(request.params.id, request.body ?? {}, () =>
      execution.executeTask(request.params.id),
    );
    reply.code(202);
    return result;
  });
  app.post<{ Params: { id: string } }>("/api/tasks/:id/cancel-execution", (request) =>
    controlled(request.params.id, request.body ?? {}, () =>
      execution.cancelTask(request.params.id),
    ),
  );
}
