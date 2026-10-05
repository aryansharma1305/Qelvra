import { resolve } from "node:path";
import { z } from "zod";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

const EnvSchema = z.object({
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  /** Comma-separated list of browser origins allowed by CORS. */
  WEB_ORIGIN: z
    .string()
    .default("http://127.0.0.1:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
  /** Directory scratch PTY sessions may start in (and below). Defaults to the server's cwd. */
  WORKSPACE_ROOT: z.string().trim().min(1).optional(),
  /** Directory for server-owned state (agents.json and agent workspaces). Defaults to ./.qelvra. */
  DATA_DIR: z.string().trim().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ORCHESTRATION_MAX_TASKS: z.coerce.number().int().min(1).max(20).default(20),
  ORCHESTRATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(3),
  ORCHESTRATION_MAX_CONCURRENT: z.coerce.number().int().min(1).max(5).default(3),
  ORCHESTRATION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(24 * 60 * 60 * 1000)
    .default(60 * 60 * 1000),
  EXECUTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30 * 60 * 1000)
    .default(20 * 60 * 1000),
});

export interface ServerConfig {
  host: string;
  port: number;
  webOrigins: readonly string[];
  workspaceRoot: string;
  dataDir: string;
  logLevel: z.infer<typeof EnvSchema>["LOG_LEVEL"];
  isProduction: boolean;
  executionTimeoutMs: number;
  orchestration: {
    maxTasks: number;
    maxAttempts: number;
    maxConcurrent: number;
    timeoutMs: number;
  };
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** Parses configuration from environment variables; throws ConfigError on invalid input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid server configuration: ${details}`);
  }
  const {
    HOST,
    PORT,
    WEB_ORIGIN,
    WORKSPACE_ROOT,
    DATA_DIR,
    LOG_LEVEL,
    NODE_ENV,
    EXECUTION_TIMEOUT_MS,
    ORCHESTRATION_MAX_TASKS,
    ORCHESTRATION_MAX_ATTEMPTS,
    ORCHESTRATION_MAX_CONCURRENT,
    ORCHESTRATION_TIMEOUT_MS,
  } = parsed.data;
  return {
    host: HOST,
    port: PORT,
    // Origins are compared exactly by CORS, so normalise away trailing slashes.
    webOrigins: WEB_ORIGIN.map((origin) => new URL(origin).origin),
    workspaceRoot: resolve(WORKSPACE_ROOT ?? process.cwd()),
    dataDir: resolve(DATA_DIR ?? ".qelvra"),
    logLevel: LOG_LEVEL,
    isProduction: NODE_ENV === "production",
    executionTimeoutMs: EXECUTION_TIMEOUT_MS,
    orchestration: {
      maxTasks: ORCHESTRATION_MAX_TASKS,
      maxAttempts: ORCHESTRATION_MAX_ATTEMPTS,
      maxConcurrent: ORCHESTRATION_MAX_CONCURRENT,
      timeoutMs: ORCHESTRATION_TIMEOUT_MS,
    },
  };
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}
