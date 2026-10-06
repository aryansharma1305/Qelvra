import { PtyManager } from "../../../apps/server/src/pty/index";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderDefinition } from "../../../apps/server/src/providers/provider-types";
import { PROVIDER_DEFINITIONS, ProviderRegistry } from "../../../apps/server/src/providers/index";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { ProviderListResponseSchema } from "@qelvra/shared";
let dir: string;
let app: Awaited<ReturnType<typeof createApp>>;
const definitions = PROVIDER_DEFINITIONS.map((d) =>
  d.id === "codex" ? { ...d, args: [resolve("tests/fixtures/provider-cli.mjs")] } : d,
);
const detect = vi.fn(async (def: ProviderDefinition) => ({
  executable: def.id === "gemini" ? null : process.execPath,
  provider: {
    id: def.id,
    name: def.name,
    kind: def.kind,
    capabilities: def.capabilities,
    available: def.id !== "gemini",
    version: "1.2.3",
    reason: def.id === "gemini" ? ("CLI_NOT_FOUND" as const) : null,
    configured: true,
    auth: "not-required" as const,
  },
}));
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-provider-runtime-"));
  detect.mockClear();
  app = await createApp(
    loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
    {
      logger: false,
      // A poisoned parent environment proves the actual PTY replaces, rather than merges, it.
      ptyManager: new PtyManager({
        workspaceRoot: dir,
        env: {
          PATH: process.env.PATH,
          HOME: dir,
          UNRELATED_SECRET: "parent-secret-marker",
          NODE_OPTIONS: "--invalid",
        },
      }),
      providerRegistry: new ProviderRegistry({
        definitions,
        detector: {
          env: {
            PATH: process.env.PATH,
            HOME: dir,
            UNRELATED_SECRET: "secret-marker",
            NODE_OPTIONS: "--invalid",
          },
          detect,
        },
      }),
    },
  );
  await app.ready();
});
afterEach(async () => {
  await app.close();
  expect(app.runtime.size).toBe(0);
  expect(app.pty.size).toBe(0);
  await rm(dir, { recursive: true, force: true });
});
describe("provider API to actual PTY", () => {
  it("starts the fixture in its agent workspace, attaches, resizes, receives input and cleans its child", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: {
        id: "fixture",
        name: "Fixture",
        role: "Test",
        providerId: "codex",
        executable: "/evil",
        args: ["evil"],
        env: { EVIL: "yes" },
        cwd: "/evil",
      },
    });
    expect(response.statusCode).toBe(201);
    const start = await app.inject({
      method: "POST",
      url: "/api/agents/fixture/start",
      payload: {
        command: "sh -c evil",
        executable: "/evil",
        args: ["evil"],
        cwd: "/evil",
        env: {},
      },
    });
    expect(start.statusCode).toBe(400);
    expect(app.runtime.get("fixture")).toBeUndefined();
    expect(
      (await app.inject({ method: "POST", url: "/api/agents/fixture/start" })).statusCode,
    ).toBe(200);
    const runtime = required(app.runtime.get("fixture"));
    const session = required(app.pty.get(runtime.sessionId));
    expect(session.shell).toBe(process.execPath);
    expect(session.args).toEqual([resolve("tests/fixtures/provider-cli.mjs")]);
    let output = "";
    const attachment = app.runtime.attach("fixture", {
      onData: (data) => {
        output += data;
      },
      onExit: () => undefined,
      onReplaced: () => undefined,
    });
    attachment.write("STATUS\r");
    await expect.poll(() => output, { timeout: 5000 }).toContain("PROVIDER_FIXTURE_READY");
    const info = JSON.parse(
      required(output.split(/\r?\n/).find((line) => line.startsWith('{"marker"'))),
    ) as { childPid: number; cwd: string; secretPresent: boolean; loaderPresent: boolean };
    expect(info).toMatchObject({
      cwd: await realpath(join(dir, "hive/agents/fixture/workspace")),
      secretPresent: false,
      loaderPresent: false,
    });
    attachment.resize(90, 25);
    expect(app.pty.get(runtime.sessionId)).toMatchObject({ cols: 90, rows: 25 });
    attachment.write("hello\r");
    await expect.poll(() => output).toContain("ECHO hello");
    attachment.detach();
    expect((await app.inject({ method: "POST", url: "/api/agents/fixture/stop" })).statusCode).toBe(
      200,
    );
    await expect.poll(() => alive(required(session.pid))).toBe(false);
    await expect.poll(() => alive(info.childPid)).toBe(false);
    await app.runtime.restart("fixture");
    await app.runtime.stop("fixture");
    await app.activity.flush();
    const events = await readFile(join(dir, "events.jsonl"), "utf8");
    expect(events).toContain('"providerId":"codex"');
    expect(events).not.toContain("secret-marker");
    expect(events).not.toContain("PROVIDER_FIXTURE_READY");
  });
  it("lists canonical path-free availability, caches reads, and isolates missing providers", async () => {
    const first = await app.inject({ url: "/api/providers" });
    const body = ProviderListResponseSchema.parse(first.json());
    expect(body.providers).toHaveLength(7);
    expect(body.providers.find((d) => d.id === "gemini")).toMatchObject({
      available: false,
      reason: "CLI_NOT_FOUND",
    });
    expect(first.body).not.toContain(process.execPath);
    expect(first.body).not.toContain(dir);
    await app.inject({ url: "/api/providers" });
    expect(detect).toHaveBeenCalledTimes(7);
  });
  it("accepts unavailable metadata but starting returns a safe provider error with no PTY", async () => {
    await app.runtime.create({
      id: "missing",
      name: "Missing",
      role: "Test",
      providerId: "gemini",
    });
    const result = await app.inject({ method: "POST", url: "/api/agents/missing/start" });
    expect(result.statusCode).toBe(409);
    expect(result.json()).toMatchObject({ error: { code: "PROVIDER_UNAVAILABLE" } });
    expect(app.runtime.size).toBe(0);
    expect(app.pty.size).toBe(0);
    expect(app.agents.require("missing").status).toBe("error");
    await app.activity.flush();
    const events = await readFile(join(dir, "events.jsonl"), "utf8");
    expect(events).toContain('"errorCode":"PROVIDER_UNAVAILABLE"');
    expect(events).toContain('"providerId":"gemini"');
  });
  it("sanitizes a native spawn failure in the response and activity", async () => {
    await app.runtime.create({ id: "failure", name: "Failure", role: "Test", providerId: "codex" });
    const native = vi.spyOn(app.pty, "createSession").mockImplementationOnce(() => {
      throw new Error("PRIVATE_SPAWN_DIAGNOSTIC secret-marker /private/credentials");
    });
    try {
      const res = await app.inject({ method: "POST", url: "/api/agents/failure/start" });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: { code: "PROVIDER_LAUNCH_FAILED" } });
      expect(res.body).not.toMatch(/PRIVATE_SPAWN|secret-marker|credentials/);
      expect(app.pty.size).toBe(0);
      await app.activity.flush();
      const events = await readFile(join(dir, "events.jsonl"), "utf8");
      expect(events).toContain('"errorCode":"PROVIDER_LAUNCH_FAILED"');
      expect(events).not.toMatch(/PRIVATE_SPAWN|secret-marker|credentials/);
    } finally {
      native.mockRestore();
    }
  });
  it("rejects unknown provider input without any process or metadata", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "Evil", role: "Test", providerId: "evil;sh" },
    });
    expect(res.statusCode).toBe(400);
    expect(app.agents.size).toBe(0);
    expect(detect).not.toHaveBeenCalled();
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing provider fixture value");
  return value;
}
