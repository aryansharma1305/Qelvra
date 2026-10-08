import { mkdtemp, rm, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderListResponseSchema, SettingsResponseSchema } from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { settingsSnapshot } from "../../../apps/server/src/routes/settings";
import { ProviderRegistry } from "../../../apps/server/src/providers/provider-registry";
import { PROVIDER_DEFINITIONS } from "../../../apps/server/src/providers/provider-types";
import { SERVER_VERSION } from "../../../apps/server/src/version";

const apps: FastifyInstance[] = [],
  dirs: string[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function setup(production = false, registry?: ProviderRegistry, ephemeral = false) {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-settings-api-"));
  dirs.push(dir);
  const config = loadConfig({
    DATA_DIR: dir,
    WORKSPACE_ROOT: dir,
    NODE_ENV: production ? "production" : "test",
    HOST: production ? "0.0.0.0" : "127.0.0.1",
    WEB_ORIGIN: "http://127.0.0.1:5174",
    OPENAI_API_KEY: "PRIVATE_ENV_KEY",
  });
  const app = await createApp(ephemeral ? { ...config, port: 0 } : config, {
    logger: false,
    providerRegistry:
      registry ??
      new ProviderRegistry({ allowFake: !production, env: { PATH: "", SHELL: "/bin/sh" } }),
  });
  apps.push(app);
  await app.ready();
  return { app, config, dir };
}
async function files(dir: string): Promise<Record<string, { bytes: string; mtime: number }>> {
  const result: Record<string, { bytes: string; mtime: number }> = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, await files(path));
    else if (entry.isFile())
      result[path] = {
        bytes: (await readFile(path)).toString("base64"),
        mtime: (await stat(path)).mtimeMs,
      };
  }
  return result;
}
describe("Settings and explicit provider refresh", () => {
  it("supports an OS-assigned port and reports the actual listening API port", async () => {
    const { app } = await setup(false, undefined, true);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing listening address");
    const result = SettingsResponseSchema.parse((await app.inject("/api/settings")).json());
    expect(result.network.port).toBe(address.port);
    expect(result.network.port).toBeGreaterThan(0);
  });
  it("shows effective startup/runtime identity and preserves every data file across reads/refresh/restart", async () => {
    const { app, config, dir } = await setup();
    await app.runtime.create({ name: "Settings fixture", role: "Engineer", providerId: "fake" });
    await app.tasks.create({ title: "PRIVATE_TASK_BODY", assignee: "settings-fixture" });
    await writeFile(join(dir, "hive/agents/settings-fixture/memory.md"), "PRIVATE_MEMORY");
    await writeFile(
      join(dir, "hive/agents/settings-fixture/workspace/private.txt"),
      "PRIVATE_WORKSPACE",
    );
    await app.activity.flush();
    const before = await files(dir);
    const expected = settingsSnapshot(config, SERVER_VERSION);
    expect((await app.inject("/api/health")).json().version).toBe(expected.general.version);
    for (let n = 0; n < 3; n++) {
      const read = await app.inject("/api/settings");
      expect(read.statusCode).toBe(200);
      expect(read.headers["cache-control"]).toBe("no-store");
      expect(SettingsResponseSchema.parse(read.json())).toEqual(expected);
      const refresh = await app.inject({
        method: "POST",
        url: "/api/providers/refresh",
        payload: {},
      });
      expect(refresh.statusCode).toBe(200);
      const result = ProviderListResponseSchema.parse(refresh.json());
      expect(result.providers.find((p) => p.id === "fake")?.available).toBe(true);
      expect(read.body + refresh.body).not.toMatch(
        /PRIVATE|API_KEY|memory\.md|private\.txt|executable|stdout|stderr/,
      );
    }
    expect(await files(dir)).toEqual(before);
    await app.close();
    const restarted = await createApp(config, { logger: false });
    apps.push(restarted);
    await restarted.ready();
    expect(SettingsResponseSchema.parse((await restarted.inject("/api/settings")).json())).toEqual(
      expected,
    );
    expect(await readFile(join(dir, "hive/agents/settings-fixture/memory.md"), "utf8")).toBe(
      "PRIVATE_MEMORY",
    );
  });
  it("captures a defensive startup snapshot and distinguishes production/non-loopback/Fake-disabled state", async () => {
    const { app, config } = await setup(true);
    config.host = "localhost";
    const result = SettingsResponseSchema.parse((await app.inject("/api/settings")).json());
    expect(result.general.environment).toBe("production");
    expect(result.network).toMatchObject({
      host: "0.0.0.0",
      loopbackOnly: false,
      apiAuthentication: "not-enabled",
    });
    const response = await app.inject({ method: "POST", url: "/api/providers/refresh" });
    expect(response.statusCode).toBe(200);
    expect(response.json().providers.find((p: { id: string }) => p.id === "fake")).toMatchObject({
      available: false,
      reason: "DISABLED_IN_PRODUCTION",
    });
  });
  it("rejects settings writes, unknown queries and provider command/body options", async () => {
    const { app } = await setup();
    for (const url of [
      "/api/settings?secret=value",
      "/api/providers/refresh?force=true",
      "/api/providers/refresh?provider=codex",
    ]) {
      const response = await app.inject({ method: url.includes("refresh") ? "POST" : "GET", url });
      expect(response.statusCode).toBe(400);
    }
    for (const payload of [
      { env: { PRIVATE: "secret" } },
      { args: ["--evil"] },
      { providerId: "codex" },
      [],
      null,
      "private",
    ])
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/providers/refresh",
            headers: { "content-type": "application/json" },
            payload: JSON.stringify(payload),
          })
        ).statusCode,
      ).toBe(400);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const)
      expect((await app.inject({ method, url: "/api/settings", payload: {} })).statusCode).toBe(
        404,
      );
  });
  it("uses existing browser-origin and loopback-Host protection for refresh", async () => {
    const { app } = await setup();
    for (const headers of [
      { origin: "https://evil.invalid" },
      { "sec-fetch-site": "cross-site" },
      { host: "evil.invalid" },
    ])
      expect(
        (await app.inject({ method: "POST", url: "/api/providers/refresh", headers })).statusCode,
      ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/providers/refresh",
          headers: { origin: "http://127.0.0.1:5174", host: "localhost" },
        })
      ).statusCode,
    ).toBe(200);
  });
  it("contains secret-bearing probe failures and recovers", async () => {
    let fail = true;
    const detect = vi.fn(async (def: (typeof PROVIDER_DEFINITIONS)[number]) => {
      if (fail) throw new Error("PRIVATE_CREDENTIAL_PROBE_OUTPUT");
      return {
        executable: null,
        provider: {
          id: def.id,
          name: def.name,
          kind: def.kind,
          capabilities: def.capabilities,
          available: false,
          version: null,
          reason: "CLI_NOT_FOUND" as const,
          configured: true,
          auth: "unknown" as const,
        },
      };
    });
    const { app } = await setup(
      false,
      new ProviderRegistry({ detector: { env: { PRIVATE: "secret" }, detect } }),
    );
    const failure = await app.inject({ method: "POST", url: "/api/providers/refresh" });
    expect(failure.statusCode).toBe(503);
    expect(failure.json().error.code).toBe("PROVIDER_DETECTION_FAILED");
    expect(failure.body).not.toMatch(/PRIVATE|secret|CREDENTIAL/);
    fail = false;
    expect((await app.inject({ method: "POST", url: "/api/providers/refresh" })).statusCode).toBe(
      200,
    );
  });
  it("shares one discovery operation across ten simultaneous HTTP refreshes", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const detect = vi.fn(async (def: (typeof PROVIDER_DEFINITIONS)[number]) => {
      await gate;
      return {
        executable: null,
        provider: {
          id: def.id,
          name: def.name,
          kind: def.kind,
          capabilities: def.capabilities,
          available: false,
          version: null,
          reason: "CLI_NOT_FOUND" as const,
          configured: true,
          auth: "unknown" as const,
        },
      };
    });
    const { app } = await setup(false, new ProviderRegistry({ detector: { env: {}, detect } }));
    const requests = Promise.all(
      Array.from({ length: 10 }, () =>
        app.inject({ method: "POST", url: "/api/providers/refresh" }),
      ),
    );
    try {
      await vi.waitFor(() => expect(detect).toHaveBeenCalledTimes(3));
    } finally {
      release();
    }
    const responses = await requests;
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(detect).toHaveBeenCalledTimes(PROVIDER_DEFINITIONS.length);
  });
});
