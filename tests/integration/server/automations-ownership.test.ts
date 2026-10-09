import { required } from "../../fixtures/automations";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile, lstat, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, it, expect } from "vitest";
import { acquireDataDirectory } from "../../../apps/server/src/release/data-directory-owner";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
let dir: string, child: ChildProcess | undefined;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-owner-"));
});
afterEach(async () => {
  if (child?.exitCode === null && child.signalCode === null) {
    const exited = new Promise<void>((r) => required(child).once("exit", () => r()));
    child.kill("SIGKILL");
    await exited;
  }
  child = undefined;
  await rm(dir, { recursive: true, force: true });
});
async function processOwner() {
  child = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), resolve("tests/fixtures/ownership-process.ts")],
    { env: { ...process.env, DATA_DIR: dir }, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  required(child.stdout).on("data", (chunk) => {
    output += chunk.toString();
  });
  await expect.poll(() => output, { timeout: 6000 }).toContain("OWNER_ACQUIRED");
  return child;
}
it("second process cannot acquire storage or even recover snapshots; clean release permits restart", async () => {
  await processOwner();
  const before = await readFile(join(dir, ".server-owner/token"), "utf8");
  await writeFile(join(dir, "agents.json"), "PRIVATE_CORRUPT_MARKER");
  await expect(
    createApp(loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" }), {
      logger: false,
    }),
  ).rejects.toThrow("server ownership");
  expect(await readFile(join(dir, "agents.json"), "utf8")).toBe("PRIVATE_CORRUPT_MARKER");
  expect(await readFile(join(dir, ".server-owner/token"), "utf8")).toBe(before);
  const exited = new Promise<void>((r) => required(child).once("exit", () => r()));
  required(child).kill("SIGTERM");
  await exited;
  await expect(lstat(join(dir, ".server-owner"))).rejects.toMatchObject({ code: "ENOENT" });
  const owner = await acquireDataDirectory(dir);
  await owner.release();
});
it("hard crash leaves ownership fail-closed until confirmed dead and explicitly cleared", async () => {
  await processOwner();
  const exited = new Promise<void>((r) => required(child).once("exit", () => r()));
  required(child).kill("SIGKILL");
  await exited;
  await expect(acquireDataDirectory(dir)).rejects.toThrow("unreleased crash lock");
  await rm(join(dir, ".server-owner"), { recursive: true });
  const owner = await acquireDataDirectory(dir);
  await owner.release();
});
it("canonical paths share ownership and a replaced token is never released", async () => {
  const owner = await acquireDataDirectory(dir),
    alias = dir + "-alias";
  await symlink(dir, alias);
  try {
    await expect(acquireDataDirectory(alias)).rejects.toThrow();
  } finally {
    await rm(alias);
  }
  await writeFile(join(dir, ".server-owner/token"), "changed");
  await expect(owner.release()).rejects.toThrow("ownership changed");
  expect(await readFile(join(dir, ".server-owner/token"), "utf8")).toBe("changed");
});
it("startup rejects corrupt automation snapshots before any recovery and releases its claim", async () => {
  const text = JSON.stringify({ version: 999, automations: [], runs: [] });
  await writeFile(join(dir, "automations.json"), text);
  for (let n = 0; n < 2; n++)
    await expect(
      createApp(loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" }), {
        logger: false,
      }),
    ).rejects.toThrow("automations.json");
  expect(await readFile(join(dir, "automations.json"), "utf8")).toBe(text);
  await expect(lstat(join(dir, ".server-owner"))).rejects.toMatchObject({ code: "ENOENT" });
});
