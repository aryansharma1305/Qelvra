import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FastifyInstance } from "fastify";
import { afterEach, afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { AgentRegistry } from "../../../apps/server/src/agents/agent-registry";
import { ProviderRegistry } from "../../../apps/server/src/providers";
import {
  cleanupManagers,
  createTestManager,
  leakedPids,
  OutputBuffer,
  uniqueMarker,
  TEST_SHELL,
} from "../pty/helpers";

const apps: FastifyInstance[] = [];
const dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await cleanupManagers();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
afterAll(() => expect(leakedPids()).toEqual([]));
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-workspace-integration-"));
  dirs.push(dir);
  const pty = createTestManager({ workspaceRoot: dir });
  const config = loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir });
  // Runtime admission now selects its shell through ProviderRegistry. Keep this fixture
  // on the same no-rc test shell as the injected PTY, rather than the user's zsh startup.
  const app = await createApp(config, {
    logger: false,
    ptyManager: pty,
    providerRegistry: new ProviderRegistry({
      env: { ...process.env, SHELL: TEST_SHELL, HOME: dir },
    }),
  });
  apps.push(app);
  return { dir, app, pty, config };
}
async function create(app: FastifyInstance, id = "nova") {
  return app.inject({
    method: "POST",
    url: "/api/agents",
    payload: { id, name: id, role: "Test" },
  });
}

describe("agent workspace lifecycle", () => {
  it("creates a workspace and ignores browser cwd/path fields", async () => {
    const { app, dir } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "Nova", role: "Frontend", cwd: "/", path: "/tmp/escape" },
    });
    expect(response.statusCode).toBe(201);
    expect(await app.workspaces.exists("nova")).toBe(true);
    expect(await readdir(join(dir, "hive", "agents"))).toEqual(["nova"]);
    expect(response.body).not.toContain(dir);
    expect((await app.inject({ method: "GET", url: "/api/files?path=/" })).statusCode).toBe(404);
  });

  it("rolls back registry creation after workspace failure and preserves preexisting data", async () => {
    const { app, dir } = await setup();
    const root = join(dir, "hive", "agents", "nova");
    await mkdir(root);
    await writeFile(join(root, "workspace"), "existing content");
    expect((await create(app)).statusCode).toBe(500);
    expect(app.agents.get("nova")).toBeUndefined();
    const reopened = await AgentRegistry.open({ file: app.agents.file });
    expect(reopened.size).toBe(0);
    expect(await readdir(root)).toEqual(["workspace"]);
    expect(await readFile(join(root, "workspace"), "utf8")).toBe("existing content");
  });

  it("rolls back fresh filesystem pieces and metadata on failed initialization", async () => {
    const { app, dir } = await setup();
    vi.spyOn(app.workspaces, "getWorkspacePath").mockRejectedValueOnce(new Error("disk failure"));
    expect((await create(app)).statusCode).toBe(500);
    expect(app.agents.get("nova")).toBeUndefined();
    expect(await readdir(join(dir, "hive", "agents"))).toEqual([]);
  });

  it("does not create a workspace if registry persistence fails", async () => {
    const { app, dir } = await setup();
    await mkdir(app.agents.file);
    expect((await create(app)).statusCode).toBe(500);
    expect(app.agents.size).toBe(0);
    expect(await readdir(join(dir, "hive", "agents"))).toEqual([]);
  });

  it("serializes create with start/delete and rejects duplicate creation", async () => {
    const { app } = await setup();
    const creating = app.runtime.create({ name: "Nova", role: "r" });
    const starting = app.runtime.start("nova");
    const deleting = app.runtime.delete("nova");
    await creating;
    expect((await starting).status).toBe("running");
    await deleting;
    expect(app.pty.size).toBe(0);
    expect(app.agents.size).toBe(0);
    expect(await app.workspaces.exists("nova")).toBe(true);
    const results = await Promise.all([create(app), create(app)]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([201, 409]);
  });

  it("delete preserves files and recreation reuses memory and custom agent metadata", async () => {
    const { app } = await setup();
    await create(app);
    const cwd = await app.workspaces.getWorkspacePath("nova");
    const root = join(cwd, "..");
    await writeFile(join(cwd, "project.txt"), "code");
    await writeFile(join(root, "memory.md"), "persistent notes");
    await writeFile(join(root, "agent.md"), "custom instructions");
    await app.runtime.start("nova");
    await app.runtime.delete("nova");
    expect(await readFile(join(cwd, "project.txt"), "utf8")).toBe("code");
    expect((await create(app)).statusCode).toBe(201);
    expect(await app.workspaces.getWorkspacePath("nova")).toBe(cwd);
    expect(await app.workspaces.readMetadata("nova", "memory.md")).toBe("persistent notes");
    expect(await app.workspaces.readMetadata("nova", "agent.md")).toBe("custom instructions");
  });

  it("migrates legacy metadata on startup without spawning, and preserves content across startup", async () => {
    const { app, config, pty } = await setup();
    await app.agents.create({ name: "Legacy", role: "r" });
    expect(await app.workspaces.exists("legacy")).toBe(false);
    await app.close();
    const restarted = await createApp(config, { logger: false, ptyManager: pty });
    apps.push(restarted);
    expect(await restarted.workspaces.exists("legacy")).toBe(true);
    expect(restarted.runtime.size).toBe(0);
    expect(pty.size).toBe(0);
    const cwd = await restarted.workspaces.getWorkspacePath("legacy");
    await writeFile(join(cwd, "code.txt"), "kept");
    await restarted.close();
    const again = await createApp(config, { logger: false, ptyManager: pty });
    apps.push(again);
    expect(await readFile(join(cwd, "code.txt"), "utf8")).toBe("kept");
  });

  it("fails startup and start safely for a symlinked workspace without changing metadata", async () => {
    const { app, config, dir, pty } = await setup();
    await create(app);
    const cwd = await app.workspaces.getWorkspacePath("nova");
    await rm(cwd, { recursive: true });
    const outside = join(dir, "outside");
    await mkdir(outside);
    await symlink(outside, cwd);
    await expect(app.runtime.start("nova")).rejects.toMatchObject({ code: "AGENT_START_FAILED" });
    expect(pty.size).toBe(0);
    await app.close();
    await expect(createApp(config, { logger: false, ptyManager: pty })).rejects.toThrow("Unsafe");
    const registry = await AgentRegistry.open({ file: app.agents.file });
    expect(registry.get("nova")).toBeDefined();
    expect(await readdir(outside)).toEqual([]);
  });

  it("real shells use distinct cwd, isolate relative files both ways and retain files after restart", async () => {
    const { app, pty } = await setup();
    await create(app);
    await create(app, "atlas");
    await Promise.all([app.runtime.start("nova"), app.runtime.start("atlas")]);
    const session = (id: string) => {
      const runtime = app.runtime.get(id);
      if (!runtime) throw new Error("Missing runtime");
      const info = pty.get(runtime.sessionId);
      if (!info) throw new Error("Missing PTY");
      return info;
    };
    const nova = session("nova");
    const atlas = session("atlas");
    expect(nova.cwd).toBe(await app.workspaces.getWorkspacePath("nova"));
    expect(atlas.cwd).toBe(await app.workspaces.getWorkspacePath("atlas"));
    expect(nova.cwd).not.toBe(atlas.cwd);
    async function command(id: string, command: string, line: string) {
      const info = session(id);
      const output = new OutputBuffer(pty, info.id);
      try {
        pty.write(info.id, `${command}\r`);
        await output.waitForLine(line);
      } finally {
        output.subscription.dispose();
      }
    }
    await command("nova", "pwd", nova.cwd);
    await command("atlas", "pwd", atlas.cwd);
    let marker = uniqueMarker("NOVA_FILE");
    await command(
      "nova",
      `touch only-nova.txt; test ! -e only-atlas.txt && echo ${marker}`,
      marker,
    );
    marker = uniqueMarker("ATLAS_FILE");
    await command(
      "atlas",
      `touch only-atlas.txt; test ! -e only-nova.txt && echo ${marker}`,
      marker,
    );
    marker = uniqueMarker("NOVA_ISOLATED");
    await command("nova", `test ! -e only-atlas.txt && echo ${marker}`, marker);
    await app.runtime.restart("nova");
    expect(session("nova").cwd).toBe(nova.cwd);
    marker = uniqueMarker("NOVA_PERSISTED");
    await command("nova", `test -f only-nova.txt && echo ${marker}`, marker);
  });
});
