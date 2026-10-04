// Local-only: launches an installed CLI without a prompt, task, login or model download.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderIdSchema } from "@qelvra/shared";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
const id = ProviderIdSchema.parse(process.argv[2] ?? "codex");
const browser = process.argv.includes("--browser");
const dir = await mkdtemp(join(tmpdir(), "qelvra-provider-smoke-"));
const app = await createApp(
  loadConfig({
    DATA_DIR: dir,
    WORKSPACE_ROOT: dir,
    NODE_ENV: "test",
    WEB_ORIGIN: "http://127.0.0.1:5188",
  }),
  { logger: false },
);
const tracked = new Set<number>();
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function descendants(pid: number) {
  if (process.platform === "win32") return [];
  const rows = execFileSync("ps", ["-axo", "pid=,ppid="], { timeout: 2000 })
    .toString()
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number));
  const found = new Set([pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const [child, parent] of rows)
      if (child && parent && found.has(parent) && !found.has(child)) {
        found.add(child);
        changed = true;
      }
  }
  return [...found];
}
try {
  const provider = await app.providers.get(id);
  console.log(JSON.stringify({ provider }));
  assert.ok(
    provider.available && provider.configured && provider.auth !== "auth-required",
    "Provider unavailable or needs setup; no launch attempted",
  );
  await app.runtime.create({
    id: "provider-smoke",
    name: "Provider Smoke",
    role: "Local verification",
    providerId: id,
  });
  if (browser) {
    await app.listen({ host: "127.0.0.1", port: 3115 });
    console.log(
      "Browser smoke API: http://127.0.0.1:3115; use a temporary web server on 5188 with this API URL.",
    );
    const subscription = app.agents.subscribe((event) => {
      if (event.agent.status === "running") {
        const pid = app.runtime.get(event.agent.id)?.pid;
        if (pid) {
          tracked.add(pid);
          console.log(
            JSON.stringify({
              started: id,
              pid,
              cwd: app.pty.get(app.runtime.get(event.agent.id)?.sessionId ?? "")?.cwd,
            }),
          );
        }
      }
    });
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      process.once("SIGINT", done);
      process.once("SIGTERM", done);
      setTimeout(done, 120000).unref();
    });
    subscription.dispose();
  } else {
    await app.runtime.start("provider-smoke");
    const runtime = app.runtime.get("provider-smoke");
    assert.ok(runtime?.pid);
    tracked.add(runtime.pid);
    const session = app.pty.get(runtime.sessionId);
    assert.ok(session);
    assert.equal(session.cwd, await realpath(join(dir, "hive/agents/provider-smoke/workspace")));
    let output = "";
    const terminal = app.runtime.attach(
      "provider-smoke",
      {
        onData: (data) => {
          output += data;
          if (data.includes("\u001b[6n")) app.pty.write(runtime.sessionId, "\u001b[1;1R");
        },
        onExit: () => undefined,
        onReplaced: () => undefined,
      },
      { cols: 100, rows: 30 },
    );
    const deadline = Date.now() + 15000;
    while (
      !/codex|claude|gemini|opencode|READY provider-smoke|trust|welcome|sign in/i.test(output) &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.match(
      output,
      /codex|claude|gemini|opencode|READY provider-smoke|trust|welcome|sign in/i,
      "Expected interactive startup output",
    );
    for (const pid of descendants(runtime.pid)) tracked.add(pid);
    terminal.detach();
    await app.runtime.stop("provider-smoke");
    console.log(
      JSON.stringify({
        providerId: id,
        version: provider.version,
        workspaceVerified: true,
        startupOutputVerified: true,
        trackedProcesses: tracked.size,
      }),
    );
  }
} finally {
  for (const pid of [...tracked])
    if (alive(pid)) for (const child of descendants(pid)) tracked.add(child);
  await app.close();
  assert.equal(app.pty.size, 0);
  assert.equal(app.runtime.size, 0);
  for (const pid of tracked)
    assert.equal(alive(pid), false, `Provider process ${pid} remained alive`);
  await rm(dir, { recursive: true, force: true });
  console.log("Provider smoke: PTYs and tracked processes stopped; temporary data removed.");
}
