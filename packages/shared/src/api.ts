import { z } from "zod";

/** GET /api/health */
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Body of every non-2xx API response. */
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const API_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  TASK_INVALID_ID: "TASK_INVALID_ID",
  TASK_INVALID_TITLE: "TASK_INVALID_TITLE",
  TASK_INVALID_DESCRIPTION: "TASK_INVALID_DESCRIPTION",
  TASK_INVALID_TRANSITION: "TASK_INVALID_TRANSITION",
  TASK_AGENT_NOT_FOUND: "TASK_AGENT_NOT_FOUND",
  TASK_ALREADY_ASSIGNED: "TASK_ALREADY_ASSIGNED",
  TASK_PERSISTENCE_FAILED: "TASK_PERSISTENCE_FAILED",

  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_ALREADY_EXISTS: "AGENT_ALREADY_EXISTS",
  AGENT_INVALID_ID: "AGENT_INVALID_ID",
  AGENT_INVALID_NAME: "AGENT_INVALID_NAME",
  AGENT_INVALID_ROLE: "AGENT_INVALID_ROLE",
  AGENT_INVALID_PROVIDER: "AGENT_INVALID_PROVIDER",
  AGENT_ALREADY_RUNNING: "AGENT_ALREADY_RUNNING",
  AGENT_NOT_RUNNING: "AGENT_NOT_RUNNING",
  AGENT_START_FAILED: "AGENT_START_FAILED",
  AGENT_STOP_FAILED: "AGENT_STOP_FAILED",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
