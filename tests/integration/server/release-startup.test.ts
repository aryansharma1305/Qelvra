import { mkdtemp, rm, writeFile, readFile, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app.js";
import { loadConfig } from "../../../apps/server/src/config/env.js";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "qelvra-release-startup-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const config = () =>
  loadConfig({
    DATA_DIR: directory,
    WORKSPACE_ROOT: directory,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
it.each(["agents.json", "tasks.json", "executions.json", "orchestrations.json"])(
  "names corrupt %s and preserves every snapshot before recovery",
  async (filename) => {
    const agent = {
      id: "keeper",
      name: "Keeper",
      role: "Test",
      status: "running",
      providerId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const validAgents = JSON.stringify({ version: 1, agents: [agent] });
    await writeFile(join(directory, "agents.json"), validAgents);
    await writeFile(join(directory, filename), "{broken");
    await expect(createApp(config(), { logger: false })).rejects.toThrow(filename);
    expect(await readFile(join(directory, filename), "utf8")).toBe("{broken");
    if (filename !== "agents.json")
      expect(await readFile(join(directory, "agents.json"), "utf8")).toBe(validAgents);
  },
);
it("rejects unusable workspace root and unsafe activity/quarantine paths before mutation", async () => {
  const absent = join(directory, "missing-root");
  await expect(
    createApp({ ...config(), workspaceRoot: absent }, { logger: false }),
  ).rejects.toThrow("workspace");
  await mkdir(join(directory, "events.jsonl"));
  await expect(createApp(config(), { logger: false })).rejects.toThrow("events.jsonl");
  await rm(join(directory, "events.jsonl"), { recursive: true });
  await mkdir(join(directory, "hive"));
  await symlink(directory, join(directory, "hive", "quarantine"));
  await expect(createApp(config(), { logger: false })).rejects.toThrow("quarantine");
});
