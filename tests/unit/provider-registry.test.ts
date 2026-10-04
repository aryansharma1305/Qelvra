import { describe, expect, it, vi } from "vitest";
import type { Agent, Provider } from "@qelvra/shared";
import { CreateAgentRequestSchema } from "@qelvra/shared";
import { ProviderRegistry } from "../../apps/server/src/providers/provider-registry";
import {
  PROVIDER_DEFINITIONS,
  type ProviderDefinition,
} from "../../apps/server/src/providers/provider-types";
import { providerEnvironment } from "../../apps/server/src/providers/provider-command";
const agent: Agent = {
  id: "nova",
  name: "Nova",
  role: "Test",
  status: "stopped",
  providerId: "codex",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
function detector(overrides: Partial<Provider> = {}, executable: string | null = process.execPath) {
  return {
    env: {
      PATH: "/safe",
      HOME: "/home",
      USER: "fixture",
      UNRELATED_SECRET: "secret",
      NODE_OPTIONS: "--evil",
      OPENAI_API_KEY: "secret",
      ANTHROPIC_API_KEY: "secret",
      QELVRA_DATA_DIR: "/private",
    },
    detect: vi.fn(async (def: ProviderDefinition) => ({
      executable,
      provider: {
        id: def.id,
        name: def.name,
        kind: def.kind,
        capabilities: def.capabilities,
        available: true,
        version: "1.2.3",
        reason: null,
        configured: true,
        auth: "unknown" as const,
        ...overrides,
      },
    })),
  };
}
describe("provider registry and commands", () => {
  it("rejects unknown IDs without invoking a process", async () => {
    const d = detector();
    const registry = new ProviderRegistry({ detector: d });
    await expect(registry.get("evil;sh")).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
    await expect(
      registry.resolve({ ...agent, providerId: "unknown" }, "/workspace", "/data"),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
    expect(d.detect).not.toHaveBeenCalled();
  });
  it("caches, coalesces concurrent calls, expires and refreshes", async () => {
    let now = 0;
    const d = detector();
    const r = new ProviderRegistry({ detector: d, clock: () => now });
    await Promise.all([r.get("codex"), r.get("codex")]);
    expect(d.detect).toHaveBeenCalledTimes(1);
    const value = await r.get("codex");
    value.available = false;
    expect((await r.get("codex")).available).toBe(true);
    now = 60001;
    await r.get("codex");
    expect(d.detect).toHaveBeenCalledTimes(2);
    await r.refresh();
    expect(d.detect).toHaveBeenCalledTimes(9);
  });
  it("bounds concurrent detections to three", async () => {
    let active = 0,
      peak = 0;
    const d = detector();
    const original = d.detect;
    const r = new ProviderRegistry({
      detector: {
        ...d,
        detect: async (def) => {
          peak = Math.max(peak, ++active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          const result = await original(def);
          active--;
          return result;
        },
      },
    });
    expect(await r.list()).toHaveLength(7);
    expect(peak).toBe(3);
  });
  it("owns executable, argv, workspace and environment despite hostile agent properties", async () => {
    const r = new ProviderRegistry({ detector: detector() });
    const input = {
      ...agent,
      executable: "/evil",
      command: "sh -c evil",
      args: ["--evil"],
      cwd: "/evil",
      env: { EVIL: "yes" },
    };
    const command = await r.resolve(input, "/managed/hive/agents/nova/workspace", "/managed");
    expect(command.file).toBe(process.execPath);
    expect(command.args).toEqual(required(PROVIDER_DEFINITIONS.find((d) => d.id === "codex")).args);
    expect(command.cwd).toBe("/managed/hive/agents/nova/workspace");
    expect(command.inheritEnv).toBe(false);
    expect(command.env).toEqual({
      PATH: "/safe",
      HOME: "/home",
      USER: "fixture",
      TERM: "xterm-256color",
    });
    expect(command.args.join(" ")).not.toMatch(/sh -c|bypass|--evil/);
  });
  it.each([
    [{ available: false, reason: "CLI_NOT_FOUND" }, "PROVIDER_UNAVAILABLE"],
    [{ available: false, reason: "DETECTION_FAILED" }, "PROVIDER_DETECTION_FAILED"],
    [{ auth: "auth-required" }, "PROVIDER_AUTH_REQUIRED"],
    [{ configured: false }, "PROVIDER_CONFIGURATION_REQUIRED"],
  ] as const)("rejects unusable provider %#", async (state, code) => {
    const r = new ProviderRegistry({ detector: detector(state) });
    await expect(r.resolve(agent, "/workspace", "/data")).rejects.toMatchObject({ code });
  });
  it("revalidates the executable at launch", async () => {
    const r = new ProviderRegistry({ detector: detector({}, "/nonexistent/executable") });
    await expect(r.resolve(agent, "/workspace", "/data")).rejects.toMatchObject({
      code: "PROVIDER_EXECUTABLE_NOT_FOUND",
    });
  });
  it("routes fake through the same resolver with only its owned runtime variables", async () => {
    const r = new ProviderRegistry({ detector: detector() });
    const result = await r.resolve({ ...agent, providerId: "fake" }, "/workspace", "/data");
    expect(result.file).toBe(process.execPath);
    expect(result.env).toMatchObject({ QELVRA_AGENT_ID: "nova", QELVRA_DATA_DIR: "/data" });
    expect(result.env.UNRELATED_SECRET).toBeUndefined();
    expect(result.args.at(-1)).toMatch(/fake-agent\/cli.ts$/);
  });
  it("keeps null as local shell and never selects a cloud default", async () => {
    const d = detector();
    const r = new ProviderRegistry({ detector: d });
    await r.resolve({ ...agent, providerId: null }, "/workspace", "/data");
    expect(d.detect.mock.calls[0]?.[0].id).toBe("shell");
  });
  it("accepts known unavailable metadata, rejects unknown IDs and strips browser process fields", () => {
    const parsed = CreateAgentRequestSchema.parse({
      name: "Nova",
      role: "Test",
      providerId: "gemini",
      args: [],
      executable: "/evil",
      cwd: "/evil",
      env: {},
      command: "evil",
    });
    expect(parsed).toEqual({ name: "Nova", role: "Test", providerId: "gemini" });
    expect(
      CreateAgentRequestSchema.safeParse({ name: "Nova", role: "Test", providerId: "evil" })
        .success,
    ).toBe(false);
  });
  it("environment allowlist excludes credential and loader variables on all providers", () => {
    expect(
      providerEnvironment({
        PATH: "/safe",
        HOME: "/home",
        Path: "/other",
        SYSTEM_SECRET: "secret",
        GEMINI_API_KEY: "secret",
        LD_PRELOAD: "/evil",
        DYLD_INSERT_LIBRARIES: "/evil",
        NODE_OPTIONS: "--evil",
      }),
    ).toEqual({ PATH: "/safe", HOME: "/home", TERM: "xterm-256color" });
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing provider fixture value");
  return value;
}
