import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app.js";
import { loadConfig } from "../../../apps/server/src/config/env.js";
let directory: string;
let app: Awaited<ReturnType<typeof createApp>>;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "qelvra-release-http-"));
  app = await createApp(
    loadConfig({
      DATA_DIR: directory,
      WORKSPACE_ROOT: directory,
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    }),
    { logger: false },
  );
  await app.ready();
});
afterEach(async () => {
  await app?.close();
  await rm(directory, { recursive: true, force: true });
});
it("rejects foreign-origin bodyless lifecycle actions before starting a provider", async () => {
  const before = await app.runtime.create({ id: "release", name: "Release", role: "Test" });
  const response = await app.inject({
    method: "POST",
    url: "/api/agents/release/start",
    headers: { origin: "https://untrusted.example" },
  });
  expect(response.statusCode).toBe(403);
  expect(app.agents.require("release")).toEqual(before);
  expect(app.pty.size).toBe(0);
});
it("rejects a DNS-rebinding hostname while retaining loopback clients and allowed browser origins", async () => {
  expect(
    (await app.inject({ url: "/api/agents", headers: { host: "rebind.example:3001" } })).statusCode,
  ).toBe(403);
  const response = await app.inject({
    url: "/api/health",
    headers: { origin: "http://127.0.0.1:5173" },
  });
  expect(response.statusCode).toBe(200);
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
  expect(response.headers["cache-control"]).toBe("no-store");
  expect((await app.inject({ url: "/api/health" })).statusCode).toBe(200);
});
