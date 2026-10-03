import {
  AgentIdSchema,
  CreateAgentRequestSchema,
  type AgentListResponse,
  type AgentResponse,
  type ApiErrorCode,
} from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import {
  AgentError,
  type AgentErrorCode,
  type AgentRegistry,
  type AgentRuntimeManager,
} from "../agents/index.js";
import { AppError } from "../lib/errors.js";

const STATUS_BY_CODE: Record<AgentErrorCode, number> = {
  AGENT_NOT_FOUND: 404,
  AGENT_ALREADY_EXISTS: 409,
  AGENT_INVALID_ID: 400,
  AGENT_INVALID_NAME: 400,
  AGENT_INVALID_ROLE: 400,
  AGENT_INVALID_TRANSITION: 409,
  AGENT_ALREADY_RUNNING: 409,
  AGENT_NOT_RUNNING: 409,
  AGENT_START_FAILED: 500,
  AGENT_STOP_FAILED: 500,
  AGENT_PERSISTENCE_FAILED: 500,
};

/** 5xx codes whose (generic, id-only) messages are safe and useful to the client. */
const REPORTED_5XX: ReadonlySet<AgentErrorCode> = new Set([
  "AGENT_START_FAILED",
  "AGENT_STOP_FAILED",
]);

const FIELD_CODES: Record<string, ApiErrorCode> = {
  id: "AGENT_INVALID_ID",
  name: "AGENT_INVALID_NAME",
  role: "AGENT_INVALID_ROLE",
};

/** Registry errors as HTTP errors; internal codes never leak as 5xx details. */
function toAppError(error: unknown): unknown {
  if (!(error instanceof AgentError)) return error;
  if (STATUS_BY_CODE[error.code] >= 500 && !REPORTED_5XX.has(error.code)) {
    return error; // generic 500 via the error handler
  }
  const code: ApiErrorCode =
    error.code === "AGENT_INVALID_TRANSITION" ? "BAD_REQUEST" : (error.code as ApiErrorCode);
  return new AppError(STATUS_BY_CODE[error.code], code, error.message);
}

function parseAgentId(raw: unknown): string {
  const parsed = AgentIdSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(400, "AGENT_INVALID_ID", "Agent id is invalid");
  return parsed.data;
}

type LifecycleAction = "start" | "stop" | "restart";

/**
 * Agent management. Lifecycle changes go through the runtime manager, which owns the
 * agents' processes; the browser can never set a status directly.
 */
export function registerAgentRoutes(
  app: FastifyInstance,
  registry: AgentRegistry,
  runtime: AgentRuntimeManager,
): void {
  app.get("/api/agents", async (): Promise<AgentListResponse> => ({ agents: registry.list() }));

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id",
    async (request): Promise<AgentResponse> => {
      const id = parseAgentId(request.params.id);
      try {
        return { agent: registry.require(id) };
      } catch (error) {
        throw toAppError(error);
      }
    },
  );

  app.post("/api/agents", async (request, reply): Promise<AgentResponse> => {
    if (typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) {
      throw new AppError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    }
    // Unknown fields (status, command, cwd, env, ...) are stripped, never applied.
    const parsed = CreateAgentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code = FIELD_CODES[String(issue?.path[0] ?? "")] ?? "VALIDATION_ERROR";
      throw new AppError(400, code, issue?.message ?? "Invalid agent");
    }
    try {
      const agent = await runtime.create(parsed.data);
      void reply.code(201);
      return { agent };
    } catch (error) {
      throw toAppError(error);
    }
  });

  app.delete<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
    const id = parseAgentId(request.params.id);
    try {
      // Stops a running agent first; its record is removed only once the shell is gone.
      await runtime.delete(id);
    } catch (error) {
      if (error instanceof AgentError && error.code === "AGENT_STOP_FAILED") {
        request.log.error({ err: error, agentId: id }, "Agent delete failed: could not stop");
      }
      throw toAppError(error);
    }
    return reply.code(204).send();
  });

  // start: 409 AGENT_ALREADY_RUNNING if it has a shell. stop: idempotent (a stopped agent
  // is returned unchanged). restart: stop then start; a stopped agent simply starts.
  for (const action of ["start", "stop", "restart"] as const satisfies LifecycleAction[]) {
    app.post<{ Params: { id: string } }>(
      `/api/agents/:id/${action}`,
      async (request): Promise<AgentResponse> => {
        const id = parseAgentId(request.params.id);
        try {
          return { agent: await runtime[action](id) };
        } catch (error) {
          if (error instanceof AgentError && STATUS_BY_CODE[error.code] >= 500) {
            request.log.error({ err: error, agentId: id, action }, "Agent lifecycle action failed");
          }
          throw toAppError(error);
        }
      },
    );
  }
}
