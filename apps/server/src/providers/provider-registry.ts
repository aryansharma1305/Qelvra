import { ProviderIdSchema, type Agent, type Provider, type ProviderId } from "@qelvra/shared";
import { ProviderDetector, type DetectorOptions } from "./provider-detector.js";
import { ProviderError } from "./provider-errors.js";
import { resolveProviderCommand } from "./provider-command.js";
import { buildExecutionCommand, type ExecutionInput } from "./provider-execution.js";
import { ExecutionError } from "../execution/execution-errors.js";
import {
  PROVIDER_DEFINITIONS,
  type ProviderDefinition,
  type ProviderDetection,
} from "./provider-types.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
export interface ProviderRegistryOptions extends DetectorOptions {
  /** Server-only seams for deterministic tests; never read from agent/API input. */
  detector?: Pick<ProviderDetector, "detect" | "env">;
  definitions?: readonly ProviderDefinition[];
  clock?: () => number;
  ttlMs?: number;
  logger?: ServiceLogger;
}
export class ProviderRegistry {
  private readonly definitions: readonly ProviderDefinition[];
  private readonly detector: Pick<ProviderDetector, "detect" | "env">;
  private readonly cache = new Map<
    ProviderId,
    { expires: number; result: Promise<ProviderDetection> }
  >();
  private readonly clock: () => number;
  private readonly ttl: number;
  private readonly logger: ServiceLogger;
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(options: ProviderRegistryOptions = {}) {
    this.definitions = options.definitions ?? PROVIDER_DEFINITIONS;
    this.detector = options.detector ?? new ProviderDetector(options);
    this.clock = options.clock ?? Date.now;
    this.ttl = options.ttlMs ?? 60000;
    this.logger = options.logger ?? silentLogger;
  }
  private definition(id: string): ProviderDefinition {
    const parsed = ProviderIdSchema.safeParse(id);
    const def = parsed.success ? this.definitions.find((d) => d.id === parsed.data) : undefined;
    if (!def) throw new ProviderError("PROVIDER_NOT_FOUND", "Unknown AI provider.");
    return def;
  }
  private async bounded(def: ProviderDefinition): Promise<ProviderDetection> {
    if (this.active >= 3) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    try {
      const result = await this.detector.detect(def);
      if (result.provider.reason === "DETECTION_FAILED")
        this.logger.warn(
          { providerId: def.id, errorCode: "PROVIDER_DETECTION_FAILED" },
          "Provider detection failed",
        );
      return result;
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
  private detect(id: string): Promise<ProviderDetection> {
    const def = this.definition(id);
    const cached = this.cache.get(def.id);
    if (cached && cached.expires > this.clock()) return cached.result;
    const result = this.bounded(def);
    this.cache.set(def.id, { expires: this.clock() + this.ttl, result });
    return result;
  }
  async get(id: string): Promise<Provider> {
    return structuredClone((await this.detect(id)).provider);
  }
  list(): Promise<Provider[]> {
    return Promise.all(this.definitions.map((def) => this.get(def.id)));
  }
  /** Internal refresh; HTTP exposes only the read-only discovery endpoint. */
  refresh(): Promise<Provider[]> {
    this.cache.clear();
    return this.list();
  }
  async resolve(agent: Agent, cwd: string, dataDir: string) {
    const id = agent.providerId ?? "shell";
    const def = this.definition(id);
    const { provider, executable } = await this.detect(id);
    if (!provider.available || !executable)
      throw new ProviderError(
        provider.reason === "DETECTION_FAILED"
          ? "PROVIDER_DETECTION_FAILED"
          : "PROVIDER_UNAVAILABLE",
        `${def.name} CLI is not available on this machine. Check its installation and refresh availability.`,
      );
    if (!provider.configured)
      throw new ProviderError(
        "PROVIDER_CONFIGURATION_REQUIRED",
        `${def.name} needs a configured model. Model selection is not supported yet.`,
      );
    if (provider.auth === "auth-required")
      throw new ProviderError(
        "PROVIDER_AUTH_REQUIRED",
        `${def.name} needs authentication. Sign in using the provider's own CLI, then refresh availability.`,
      );
    return resolveProviderCommand(def, executable, agent, cwd, dataDir, this.detector.env);
  }
  async resolveExecution(
    agent: Agent,
    cwd: string,
    dataDir: string,
    input: ExecutionInput,
    schemaFile: string,
    resultFile: string,
  ) {
    const base = await this.resolve(agent, cwd, dataDir);
    const def = this.definition(agent.providerId ?? "shell");
    const provider = await this.get(def.id);
    if (!provider.capabilities.automation || !def.execution)
      throw new ExecutionError("PROVIDER_NOT_AUTOMATION_CAPABLE");
    return buildExecutionCommand(def, base, input, schemaFile, resultFile);
  }
}
