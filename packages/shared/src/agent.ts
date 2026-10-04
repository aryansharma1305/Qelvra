import { z } from "zod";
import { ProviderIdSchema } from "./provider.js";

/**
 * Agent ids are used as directory names under hive/agents/ and as routing
 * addresses, so they are restricted to a filesystem- and URL-safe charset.
 * This rules out path traversal ("..", "/", "\") by construction.
 */
export const AgentIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: "Agent id must be lowercase letters, digits and inner hyphens",
  });

export type AgentId = z.infer<typeof AgentIdSchema>;

/**
 * Lifecycle states. Owned by the server: no request body can set them.
 * `created` and `stopped` are the only states without a process (PR 7 adds processes).
 */
export const AGENT_STATUSES = [
  "created",
  "starting",
  "running",
  "idle",
  "working",
  "stopping",
  "stopped",
  "error",
] as const;

export const AgentStatusSchema = z.enum(AGENT_STATUSES);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AGENT_NAME_MAX_LENGTH = 80;
export const AGENT_ROLE_MAX_LENGTH = 120;

/** Printable single-line text: no control characters and no markup brackets. */
function displayText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, { message: `${label} is required` })
    .max(max, { message: `${label} must be at most ${max} characters` })
    .refine((value) => !/[\p{Cc}\p{Cf}<>]/u.test(value), {
      message: `${label} must not contain control characters or < >`,
    });
}

export const AgentNameSchema = displayText(AGENT_NAME_MAX_LENGTH, "Name");
export const AgentRoleSchema = displayText(AGENT_ROLE_MAX_LENGTH, "Role");

/** The canonical agent record (persisted and returned by the API). */
export const AgentSchema = z.object({
  id: AgentIdSchema,
  name: AgentNameSchema,
  role: AgentRoleSchema,
  status: AgentStatusSchema,
  /** Provider adapter id; fake is a development/test CLI, null uses the local shell. */
  providerId: z.string().min(1).max(64).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Agent = z.infer<typeof AgentSchema>;

/**
 * What a user may configure when creating an agent in this milestone. Deliberately no
 * status, command, arguments, cwd or environment: those are server-owned or belong to
 * later provider/workspace systems. Unknown fields are stripped.
 */
export const CreateAgentRequestSchema = z.object({
  name: AgentNameSchema,
  role: AgentRoleSchema,
  /** Optional explicit id; otherwise derived from the name (see agentIdFromName). */
  id: AgentIdSchema.optional(),
  /** Known provider ID only; executable configuration stays server-owned. */
  providerId: ProviderIdSchema.nullable().optional(),
});

export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;

export const AgentResponseSchema = z.object({ agent: AgentSchema });
export const AgentListResponseSchema = z.object({ agents: z.array(AgentSchema) });

export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type AgentListResponse = z.infer<typeof AgentListResponseSchema>;

/**
 * Derives a filesystem-safe id from a display name: "Frontend Nova" -> "frontend-nova".
 * Returns null when nothing usable remains (e.g. a name made only of symbols).
 */
export function agentIdFromName(name: string): string | null {
  const id = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return AgentIdSchema.safeParse(id).success ? id : null;
}
