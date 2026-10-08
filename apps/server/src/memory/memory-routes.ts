import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { AgentIdSchema, UpdateAgentMemoryRequestSchema, AGENT_MEMORY_LIMIT } from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import type { AgentMemoryService } from "./agent-memory-service.js";
export function registerMemoryRoutes(app: FastifyInstance, memory: AgentMemoryService) {
  const id = (request: { params: unknown; query: unknown }) => {
    const params = z.strictObject({ id: AgentIdSchema }).safeParse(request.params);
    if (!params.success) throw new AppError(400, "AGENT_INVALID_ID", "Invalid agent id");
    if (!z.strictObject({}).safeParse(request.query).success)
      throw new AppError(400, "MEMORY_INVALID_REQUEST", "Memory has no caller-selected path");
    return params.data.id;
  };
  app.get("/api/agents/:id/memory", async (request) => ({ memory: await memory.get(id(request)) }));
  app.put(
    "/api/agents/:id/memory",
    { bodyLimit: AGENT_MEMORY_LIMIT * 6 + 4096 },
    async (request) => {
      const agentId = id(request);
      const parsed = UpdateAgentMemoryRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        const large = parsed.error.issues.some(
          (issue) => issue.path[0] === "content" && issue.code === "too_big",
        );
        throw new AppError(
          large ? 413 : 400,
          large ? "MEMORY_TOO_LARGE" : "MEMORY_INVALID_REQUEST",
          "Supply UTF-8 memory and its expected revision only",
        );
      }
      return { memory: await memory.update(agentId, parsed.data) };
    },
  );
}
