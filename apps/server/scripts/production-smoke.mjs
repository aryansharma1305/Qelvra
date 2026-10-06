// Production bundles, disposable state, real HTTP boundaries. No provider execution or seeding.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const data = await mkdtemp(join(tmpdir(), "qelvra-production-"));
const children = [];
async function start(args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: resolve("../.."),
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
  children.push(child);
  return child;
}
async function stop(child) {
  if (child.exitCode !== null) return;
  const done = new Promise((r) => child.once("exit", r));
  child.kill("SIGINT");
  await done;
}
const base = "http://127.0.0.1:3098/api";
try {
  const server = await start([resolve("dist/index.js")], {
    NODE_ENV: "production",
    DATA_DIR: data,
    WORKSPACE_ROOT: data,
    PORT: "3098",
    WEB_ORIGIN: "http://127.0.0.1:5198",
    LOG_LEVEL: "warn",
  });
  const deadline = Date.now() + 20000;
  while (true) {
    try {
      if ((await fetch(base + "/health")).ok) break;
    } catch {
      /* starting */
    }
    if (Date.now() > deadline || server.exitCode !== null)
      throw new Error("Production startup failed");
    await new Promise((r) => setTimeout(r, 50));
  }
  const health = await fetch(base + "/health");
  assert.equal((await health.json()).version, "0.1.0-beta.1");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  for (const key of ["agents", "tasks", "orchestrations"])
    assert.deepEqual((await (await fetch(base + "/" + key)).json())[key], []);
  assert.equal(
    (await fetch(base + "/health", { headers: { Origin: "https://untrusted.example" } })).status,
    403,
  );
  const providers = (await (await fetch(base + "/providers")).json()).providers;
  const fake = providers.find((p) => p.id === "fake");
  assert.equal(fake.available, false);
  assert.equal(fake.reason, "DISABLED_IN_PRODUCTION");
  const creation = await fetch(base + "/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Production fake rejected",
      role: "Disposable",
      providerId: "fake",
    }),
  });
  assert.equal(creation.status, 400);
  assert.equal((await creation.json()).error.code, "AGENT_INVALID_PROVIDER");
  assert.deepEqual((await (await fetch(base + "/agents")).json()).agents, []);
  for (const route of ["/api/test/reset", "/api/debug", "/api/fixtures"])
    assert.equal((await fetch("http://127.0.0.1:3098" + route)).status, 404);
  const web = spawn(
    process.execPath,
    [
      resolve("../../node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "5198",
      "--strictPort",
    ],
    { cwd: resolve("../web"), stdio: "ignore" },
  );
  children.push(web);
  while (true) {
    try {
      if ((await fetch("http://127.0.0.1:5198")).ok) break;
    } catch {
      /* starting */
    }
    if (Date.now() > deadline || web.exitCode !== null) throw new Error("Built web preview failed");
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.match(await (await fetch("http://127.0.0.1:5198")).text(), /Qelvra/);
  const license = await readFile(resolve("../../LICENSE"), "utf8");
  assert.equal(await (await fetch("http://127.0.0.1:5198/LICENSE")).text(), license);
  assert.equal(await readFile(resolve("dist/LICENSE"), "utf8"), license);
  assert.match(
    await (await fetch("http://127.0.0.1:5198/NOTICE")).text(),
    /Copyright 2026 Aryan Sharma and Qelvra contributors/,
  );
  const notices = await (await fetch("http://127.0.0.1:5198/THIRD_PARTY_NOTICES.txt")).text();
  for (const file of await readdir(resolve("../../third-party/licenses")))
    assert.ok(
      notices.includes(await readFile(resolve("../../third-party/licenses", file), "utf8")),
    );
  assert.equal(await readFile(resolve("dist/THIRD_PARTY_NOTICES.txt"), "utf8"), notices);
  const assets = await readdir(resolve("../web/dist/assets"));
  assert.equal(
    assets.some((f) => f.endsWith(".map")),
    false,
  );
  const scripts = await Promise.all(
    assets
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFile(resolve("../web/dist/assets", f), "utf8")),
  );
  assert.equal(
    scripts.some((s) => s.includes("QELVRA_TEST_PORT") || s.includes("tests/fixtures")),
    false,
  );
  console.log(
    JSON.stringify({
      production: true,
      version: "0.1.0-beta.1",
      fakeRejected: true,
      emptyState: true,
      origins: true,
      headers: true,
      builtWeb: true,
      distributionNotices: true,
      webSourceMaps: false,
      testRoutes: false,
      result: "PASS",
    }),
  );
} finally {
  for (const child of children.reverse()) await stop(child);
  await rm(data, { recursive: true, force: true });
}
