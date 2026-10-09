import {
  AutomationInputSchema,
  AutomationListSchema,
  AutomationResponseSchema,
  AutomationHistorySchema,
  AutomationRunResponseSchema,
  type AutomationInput,
} from "@qelvra/shared";
import { NetworkQuerySchema, NetworkResponseSchema, type NetworkQuery } from "@qelvra/shared";
import { AnalyticsResponseSchema, AnalyticsQuerySchema, type AnalyticsQuery } from "@qelvra/shared";
import { AgentMemoryResponseSchema } from "@qelvra/shared";
import { SettingsResponseSchema } from "@qelvra/shared";
import {
  WorkspaceListingSchema,
  WorkspaceFileResponseSchema,
  WorkspaceEntryResponseSchema,
  type WorkspaceWriteRequest,
} from "@qelvra/shared";
import { ProviderListResponseSchema, type Provider } from "@qelvra/shared";
import { TaskExecutionResponseSchema } from "@qelvra/shared";
import {
  OrchestrationListResponseSchema,
  OrchestrationResponseSchema,
  type CreateOrchestrationRequest,
} from "@qelvra/shared";
import {
  ActivityListResponseSchema,
  ActivitySummarySchema,
  type ActivityType,
} from "@qelvra/shared";
import {
  TaskListResponseSchema,
  TaskResponseSchema,
  type Task,
  type CreateTaskRequest,
} from "@qelvra/shared";
import {
  AgentListResponseSchema,
  AgentResponseSchema,
  ApiErrorResponseSchema,
  HealthResponseSchema,
  type Agent,
  type CreateAgentRequest,
  type HealthResponse,
} from "@qelvra/shared";
import type { z } from "zod";

// All HTTP calls to the Qelvra server go through this module.

export const DEFAULT_API_URL = "http://127.0.0.1:3001";
const DEFAULT_TIMEOUT_MS = 5_000;

export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");

export type ApiErrorKind = "network" | "timeout" | "http" | "invalid_response";

export class ApiError extends Error {
  override name = "ApiError";

  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PUT";
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** `schema: null` means the endpoint answers 204 No Content. */
async function requestJson<T>(
  path: string,
  schema: z.ZodType<T> | null,
  {
    method = "GET",
    body,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    baseUrl = apiBaseUrl,
  }: RequestOptions = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers:
        body === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: combined,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // caller cancelled; not an API failure
    if (timeout.aborted) throw new ApiError("timeout", `Request to ${path} timed out`);
    throw new ApiError("network", `Could not reach the server at ${baseUrl}`);
  }

  // 204 No Content: success with nothing to validate.
  if (response.status === 204 && schema === null) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("invalid_response", `Server returned non-JSON for ${path}`, response.status);
  }

  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(payload);
    throw new ApiError(
      "http",
      parsed.success ? parsed.data.error.message : `HTTP ${response.status}`,
      response.status,
      parsed.success ? parsed.data.error.code : undefined,
    );
  }

  if (schema === null) {
    throw new ApiError(
      "invalid_response",
      `Unexpected response body from ${path}`,
      response.status,
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      "invalid_response",
      `Unexpected response shape from ${path}`,
      response.status,
    );
  }
  return parsed.data;
}

export function getHealth(options?: RequestOptions): Promise<HealthResponse> {
  return requestJson("/api/health", HealthResponseSchema, options);
}

type CallOptions = Pick<RequestOptions, "signal" | "fetchImpl" | "baseUrl" | "timeoutMs">;

export async function listAgents(options?: CallOptions): Promise<Agent[]> {
  return (await requestJson("/api/agents", AgentListResponseSchema, options)).agents;
}

export async function getAgent(id: string, options?: CallOptions): Promise<Agent> {
  const path = `/api/agents/${encodeURIComponent(id)}`;
  return (await requestJson(path, AgentResponseSchema, options)).agent;
}

/** Only name, role and an optional id: status and process settings are server-owned. */
export async function createAgent(
  input: CreateAgentRequest,
  options?: CallOptions,
): Promise<Agent> {
  const body: CreateAgentRequest = {
    name: input.name,
    role: input.role,
    ...(input.id === undefined ? {} : { id: input.id }),
    ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
  };
  return (
    await requestJson("/api/agents", AgentResponseSchema, { ...options, method: "POST", body })
  ).agent;
}

export async function deleteAgent(id: string, options?: CallOptions): Promise<void> {
  await requestJson<undefined>(`/api/agents/${encodeURIComponent(id)}`, null, {
    ...options,
    method: "DELETE",
  });
}

export type AgentLifecycleAction = "start" | "stop" | "restart";

/** Lifecycle changes are explicit server operations; the browser never sends a status. */
async function agentLifecycle(
  id: string,
  action: AgentLifecycleAction,
  options?: CallOptions,
): Promise<Agent> {
  const path = `/api/agents/${encodeURIComponent(id)}/${action}`;
  // Starting or stopping a shell includes a grace period for its processes to exit.
  return (
    await requestJson(path, AgentResponseSchema, { timeoutMs: 15_000, ...options, method: "POST" })
  ).agent;
}

export function startAgent(id: string, options?: CallOptions): Promise<Agent> {
  return agentLifecycle(id, "start", options);
}

export function stopAgent(id: string, options?: CallOptions): Promise<Agent> {
  return agentLifecycle(id, "stop", options);
}

export function restartAgent(id: string, options?: CallOptions): Promise<Agent> {
  return agentLifecycle(id, "restart", options);
}

export async function listTasks(options?: CallOptions): Promise<Task[]> {
  return (await requestJson("/api/tasks", TaskListResponseSchema, options)).tasks;
}
export async function getTask(id: string, options?: CallOptions): Promise<Task> {
  return (await requestJson(`/api/tasks/${encodeURIComponent(id)}`, TaskResponseSchema, options))
    .task;
}
export async function createTask(input: CreateTaskRequest, options?: CallOptions): Promise<Task> {
  const body = {
    title: input.title,
    description: input.description ?? "",
    ...(input.assignee === undefined ? {} : { assignee: input.assignee }),
  };
  return (await requestJson("/api/tasks", TaskResponseSchema, { ...options, method: "POST", body }))
    .task;
}
export type TaskAction = "start" | "review" | "complete" | "fail";
async function taskAction(
  id: string,
  action: TaskAction | "assign",
  body?: unknown,
  options?: CallOptions,
): Promise<Task> {
  return (
    await requestJson(`/api/tasks/${encodeURIComponent(id)}/${action}`, TaskResponseSchema, {
      ...options,
      method: "POST",
      ...(body === undefined ? {} : { body }),
    })
  ).task;
}
export const assignTask = (id: string, agentId: string, options?: CallOptions) =>
  taskAction(id, "assign", { agentId }, options);
export const startTask = (id: string, options?: CallOptions) =>
  taskAction(id, "start", undefined, options);
export const reviewTask = (id: string, options?: CallOptions) =>
  taskAction(id, "review", undefined, options);
export const completeTask = (id: string, options?: CallOptions) =>
  taskAction(id, "complete", undefined, options);
export const failTask = (id: string, options?: CallOptions) =>
  taskAction(id, "fail", undefined, options);

export function listActivity(
  query: {
    limit?: number;
    cursor?: string;
    type?: ActivityType;
    agentId?: string;
    taskId?: string;
    entityType?: "agent" | "task" | "message" | "router" | "orchestration" | "automation";
  } = {},
  options?: CallOptions,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value));
  return requestJson(`/api/activity?${params}`, ActivityListResponseSchema, options);
}
export function getActivitySummary(options?: CallOptions) {
  return requestJson("/api/activity/summary", ActivitySummarySchema, options);
}

export async function listProviders(options?: CallOptions): Promise<Provider[]> {
  return (
    await requestJson("/api/providers", ProviderListResponseSchema, {
      timeoutMs: 20000,
      ...options,
    })
  ).providers;
}

export const getSettings = (options?: CallOptions) =>
  requestJson("/api/settings", SettingsResponseSchema, options);

export async function refreshProviders(options?: CallOptions): Promise<Provider[]> {
  return (
    await requestJson("/api/providers/refresh", ProviderListResponseSchema, {
      timeoutMs: 60000,
      ...options,
      method: "POST",
      body: {},
    })
  ).providers;
}
export const getTaskExecution = (id: string, options?: CallOptions) =>
  requestJson(
    `/api/tasks/${encodeURIComponent(id)}/execution`,
    TaskExecutionResponseSchema,
    options,
  );
export const executeTask = (id: string, options?: CallOptions) =>
  requestJson(`/api/tasks/${encodeURIComponent(id)}/execute`, TaskExecutionResponseSchema, {
    method: "POST",
    body: {},
    timeoutMs: 25000,
    ...options,
  });
export const cancelTaskExecution = (id: string, options?: CallOptions) =>
  requestJson(
    `/api/tasks/${encodeURIComponent(id)}/cancel-execution`,
    TaskExecutionResponseSchema,
    { method: "POST", body: {}, timeoutMs: 10000, ...options },
  );
export const listOrchestrations = async (options?: CallOptions) =>
  (await requestJson("/api/orchestrations", OrchestrationListResponseSchema, options))
    .orchestrations;
export const createOrchestration = async (
  body: CreateOrchestrationRequest,
  options?: CallOptions,
) =>
  (
    await requestJson("/api/orchestrations", OrchestrationResponseSchema, {
      method: "POST",
      body,
      timeoutMs: 25000,
      ...options,
    })
  ).orchestration;
export const runOrchestrationAction = async (
  id: string,
  action: "plan" | "run" | "cancel" | "resume",
  options?: CallOptions,
) =>
  (
    await requestJson(
      `/api/orchestrations/${encodeURIComponent(id)}/${action}`,
      OrchestrationResponseSchema,
      { method: "POST", body: {}, timeoutMs: 25000, ...options },
    )
  ).orchestration;

const filesPath = (id: string) => `/api/agents/${encodeURIComponent(id)}/files`;
export const listWorkspaceFiles = (id: string, path = "", options?: CallOptions) =>
  requestJson(`${filesPath(id)}?${new URLSearchParams({ path })}`, WorkspaceListingSchema, options);
export const statWorkspaceEntry = async (id: string, path: string, options?: CallOptions) =>
  (
    await requestJson(
      `${filesPath(id)}/entry?${new URLSearchParams({ path })}`,
      WorkspaceEntryResponseSchema,
      options,
    )
  ).entry;
export const readWorkspaceFile = async (id: string, path: string, options?: CallOptions) =>
  (
    await requestJson(
      `${filesPath(id)}/content?${new URLSearchParams({ path })}`,
      WorkspaceFileResponseSchema,
      options,
    )
  ).file;
export const writeWorkspaceFile = async (
  id: string,
  body: WorkspaceWriteRequest,
  options?: CallOptions,
) =>
  (
    await requestJson(`${filesPath(id)}/content`, WorkspaceFileResponseSchema, {
      ...options,
      method: "PUT",
      body,
    })
  ).file;
export const createWorkspaceFile = async (id: string, path: string, options?: CallOptions) =>
  (
    await requestJson(`${filesPath(id)}/file`, WorkspaceEntryResponseSchema, {
      ...options,
      method: "POST",
      body: { path },
    })
  ).entry;
export const createWorkspaceDirectory = async (id: string, path: string, options?: CallOptions) =>
  (
    await requestJson(`${filesPath(id)}/directory`, WorkspaceEntryResponseSchema, {
      ...options,
      method: "POST",
      body: { path },
    })
  ).entry;
export const moveWorkspaceEntry = async (
  id: string,
  from: string,
  to: string,
  options?: CallOptions,
) =>
  (
    await requestJson(`${filesPath(id)}/move`, WorkspaceEntryResponseSchema, {
      ...options,
      method: "POST",
      body: { from, to },
    })
  ).entry;
export const deleteWorkspaceEntry = (
  id: string,
  path: string,
  recursive = false,
  options?: CallOptions,
) =>
  requestJson<undefined>(filesPath(id), null, {
    ...options,
    method: "DELETE",
    body: { path, recursive },
  });

const memoryPath = (id: string) => `/api/agents/${encodeURIComponent(id)}/memory`;
export const getAgentMemory = async (id: string, options?: CallOptions) =>
  (await requestJson(memoryPath(id), AgentMemoryResponseSchema, options)).memory;
export const updateAgentMemory = async (
  id: string,
  content: string,
  expectedRevision: string,
  options?: CallOptions,
) =>
  (
    await requestJson(memoryPath(id), AgentMemoryResponseSchema, {
      ...options,
      method: "PUT",
      body: { content, expectedRevision },
    })
  ).memory;

export function getAnalytics(params: AnalyticsQuery = {}, options: RequestOptions = {}) {
  const query = AnalyticsQuerySchema.parse(params);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) search.set(key, value);
  return requestJson(
    "/api/analytics" + (search.size ? "?" + search.toString() : ""),
    AnalyticsResponseSchema,
    options,
  );
}

export async function getNetwork(query: NetworkQuery = {}, options: RequestOptions = {}) {
  const parsed = NetworkQuerySchema.parse(query);
  return requestJson(`/api/network?window=${parsed.window}`, NetworkResponseSchema, options);
}

const automationPath = (id: string) => `/api/automations/${encodeURIComponent(id)}`;
export const listAutomations = (options?: CallOptions) =>
  requestJson("/api/automations", AutomationListSchema, options);
export const automationHistory = (id: string, options?: CallOptions) =>
  requestJson(`${automationPath(id)}/runs`, AutomationHistorySchema, options);
export const createAutomation = (input: AutomationInput) =>
  requestJson("/api/automations", AutomationResponseSchema, {
    method: "POST",
    body: AutomationInputSchema.parse(input),
  });
export const updateAutomation = (id: string, revision: number, input: AutomationInput) =>
  requestJson(automationPath(id), AutomationResponseSchema, {
    method: "PUT",
    body: { ...AutomationInputSchema.parse(input), revision },
  });
export const deleteAutomation = (id: string, revision: number) =>
  requestJson(automationPath(id), null, { method: "DELETE", body: { revision } });
export const automationAction = (
  id: string,
  revision: number,
  action: "enable" | "disable" | "run",
  acknowledgeInterruption = false,
) =>
  action === "run"
    ? requestJson(`${automationPath(id)}/run`, AutomationRunResponseSchema, {
        method: "POST",
        body: { revision, acknowledgeInterruption },
      })
    : requestJson(`${automationPath(id)}/${action}`, AutomationResponseSchema, {
        method: "POST",
        body: { revision, acknowledgeInterruption },
      });
