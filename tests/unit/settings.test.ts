import { describe, expect, it, vi } from "vitest";
import { SettingsResponseSchema } from "@qelvra/shared";
import { loadConfig } from "../../apps/server/src/config/env";
import { settingsSnapshot } from "../../apps/server/src/routes/settings";
import { ProviderRegistry } from "../../apps/server/src/providers/provider-registry";
import {
  PROVIDER_DEFINITIONS,
  type ProviderDefinition,
} from "../../apps/server/src/providers/provider-types";

describe("effective settings snapshot", () => {
  it.each(["development", "test", "production"] as const)(
    "uses validated %s startup config and actual server runtime",
    (environment) => {
      const config = loadConfig({
        NODE_ENV: environment,
        DATA_DIR: "fixture-data",
        WORKSPACE_ROOT: "fixture-workspace",
        WEB_ORIGIN: "http://localhost:5173/",
        OPENAI_API_KEY: "PRIVATE_KEY",
        NODE_OPTIONS: "PRIVATE_OPTIONS",
        UNRELATED: "PRIVATE_ENV",
      });
      const result = settingsSnapshot(config, "test-version");
      expect(result).toEqual({
        general: {
          version: "test-version",
          environment,
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
        },
        storage: { dataDir: config.dataDir, workspaceRoot: config.workspaceRoot },
        network: {
          host: "127.0.0.1",
          port: 3001,
          webOrigins: ["http://localhost:5173"],
          loopbackOnly: true,
          apiAuthentication: "not-enabled",
        },
        restartRequired: true,
      });
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE|OPENAI_API_KEY|NODE_OPTIONS|UNRELATED/);
      result.network.webOrigins.push("http://changed.invalid");
      expect(config.webOrigins).toEqual(["http://localhost:5173"]);
    },
  );
  it.each([
    ["127.0.0.1", true],
    ["localhost", true],
    ["::1", true],
    ["0.0.0.0", false],
    ["192.168.1.10", false],
  ] as const)("shares security's loopback policy for %s", (host, expected) => {
    expect(settingsSnapshot(loadConfig({ HOST: host }), "test").network.loopbackOnly).toBe(
      expected,
    );
  });
  it("rejects extra fields, fabricated authentication, invalid ports and hidden mutable preferences", () => {
    const result = settingsSnapshot(loadConfig({}), "test");
    for (const invalid of [
      { ...result, environment: { PRIVATE: "secret" } },
      { ...result, general: { ...result.general, apiKey: "secret" } },
      { ...result, network: { ...result.network, apiAuthentication: "enabled" } },
      { ...result, network: { ...result.network, port: 0 } },
      { ...result, restartRequired: false },
    ])
      expect(SettingsResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("provider rediscovery coalescing", () => {
  const detection = (def: ProviderDefinition) => ({
    executable: null,
    provider: {
      id: def.id,
      name: def.name,
      kind: def.kind,
      capabilities: def.capabilities,
      available: false,
      configured: true,
      reason: "CLI_NOT_FOUND" as const,
      auth: "unknown" as const,
      version: null,
    },
  });
  it("shares one bounded operation across concurrent refresh/list requests and gives independent copies", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0,
      peak = 0;
    const detect = vi.fn(async (def: ProviderDefinition) => {
      peak = Math.max(peak, ++active);
      await gate;
      active--;
      return detection(def);
    });
    const registry = new ProviderRegistry({ detector: { env: {}, detect } });
    const requests = Array.from({ length: 20 }, () => registry.refresh());
    requests.push(registry.list());
    release();
    const results = await Promise.all(requests);
    expect(detect).toHaveBeenCalledTimes(PROVIDER_DEFINITIONS.length);
    expect(peak).toBe(3);
    const first = results[0]?.[0],
      second = results[1]?.[0];
    if (!first || !second) throw new Error("Missing coalesced provider result");
    first.available = true;
    expect(second.available).toBe(false);
    expect((await registry.get(first.id)).available).toBe(false);
  });
  it("releases failed refresh state so a subsequent refresh can recover", async () => {
    let fail = true;
    const registry = new ProviderRegistry({
      detector: {
        env: {},
        detect: async (def) => {
          if (fail) throw new Error("PRIVATE_PROBE_FAILURE");
          return detection(def);
        },
      },
    });
    await expect(registry.refresh()).rejects.toThrow("PRIVATE_PROBE_FAILURE");
    fail = false;
    expect(await registry.refresh()).toHaveLength(PROVIDER_DEFINITIONS.length);
  });
});
