import { z } from "zod";
import { AgentIdSchema } from "./agent.js";
export const AGENT_MEMORY_LIMIT = 256 * 1024;
export const AgentMemorySchema = z.strictObject({
  agentId: AgentIdSchema,
  content: z.string().max(AGENT_MEMORY_LIMIT),
  size: z.number().int().nonnegative().max(AGENT_MEMORY_LIMIT),
  modifiedAt: z.iso.datetime(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export const AgentMemoryResponseSchema = z.strictObject({ memory: AgentMemorySchema });
export const UpdateAgentMemoryRequestSchema = z.strictObject({
  content: z.string().max(AGENT_MEMORY_LIMIT),
  expectedRevision: AgentMemorySchema.shape.revision,
});
export type AgentMemory = z.infer<typeof AgentMemorySchema>;
export type UpdateAgentMemoryRequest = z.infer<typeof UpdateAgentMemoryRequestSchema>;
