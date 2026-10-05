// Local-only authenticated provider verification; never touches developer DATA_DIR.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
const providerId = process.argv[2] === "fake" ? "fake" : "codex";
const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
async function projectFingerprint() {
  const hash = createHash("sha256");
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: projectRoot },
  )
    .toString()
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const file of files) {
    hash.update(file);
    hash.update(await readFile(join(projectRoot, file)));
  }
  return hash.digest("hex");
}
const before = await projectFingerprint();
const dataDir = await mkdtemp(join(tmpdir(), "qelvra-execution-smoke-"));
const app = await createApp(
  loadConfig({ DATA_DIR: dataDir, WORKSPACE_ROOT: dataDir, LOG_LEVEL: "silent", NODE_ENV: "test" }),
  { logger: false, executionOptions: { timeoutMs: 180000 } },
);
try {
  await app.ready();
  const provider = await app.providers.get(providerId);
  console.log(
    JSON.stringify({
      providerId,
      version: provider.version,
      available: provider.available,
      automation: provider.capabilities.automation,
      auth: provider.auth,
    }),
  );
  await app.runtime.create({
    id: "execution-smoke",
    name: "Execution Smoke",
    role: "Disposable local verification",
    providerId,
  });
  const task = await app.tasks.create({
    title:
      providerId === "codex"
        ? "Create hello.txt containing exactly HELLO_QELVRA."
        : "Create landing page",
    description:
      providerId === "codex"
        ? "Create hello.txt in the current workspace containing exactly the 12 UTF-8 bytes HELLO_QELVRA. No trailing newline, BOM, spaces or other characters. Verify the byte count and contents before returning completed. Return the structured result with hello.txt in changedFiles. Do not modify any other files or task state."
        : "Write the deterministic fake result in the current workspace and return it for human review.",
    assignee: "execution-smoke",
  });
  await app.execution.executeTask(task.id);
  console.log(JSON.stringify({ taskStatus: app.tasks.require(task.id).status }));
  const deadline = Date.now() + 200000;
  while (app.execution.isActive(task.id)) {
    if (Date.now() > deadline) throw new Error("Smoke timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
  const data = app.execution.get(task.id);
  if (data.execution?.status !== "succeeded")
    throw new Error(data.execution?.errorCode ?? "Smoke failed");
  const file = providerId === "codex" ? "hello.txt" : "fake-result.txt";
  const cwd = await app.workspaces.getWorkspacePath("execution-smoke");
  const actual = await readFile(join(cwd, file), "utf8");
  if (providerId === "codex" && actual !== "HELLO_QELVRA") throw new Error("Wrong file content");
  if (!data.result?.changedFiles.includes(file) || app.tasks.require(task.id).status !== "review")
    throw new Error("Result or task state mismatch");
  console.log(
    JSON.stringify({
      providerId,
      taskStatus: "review",
      workspaceVerified: true,
      file,
      contentVerified: true,
      structuredResult: true,
      processes: app.execution.size,
      ptys: app.pty.size,
    }),
  );
  await app.tasks.complete(task.id);
  console.log("Manual review completion verified.");
  if ((await projectFingerprint()) !== before)
    throw new Error("Project files changed during execution smoke");
  console.log("Project file fingerprint unchanged.");
} finally {
  await app.close();
  const leaked = app.execution.size || app.pty.size;
  await rm(dataDir, { recursive: true, force: true });
  console.log("Execution smoke: child processes stopped; temporary data removed.");
  if (leaked) process.exitCode = 1;
}
