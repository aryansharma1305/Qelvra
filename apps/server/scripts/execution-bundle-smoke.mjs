// Disposable verification of the shipped server, watchdog and fake provider bundles.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
const directory = await mkdtemp(join(tmpdir(), "qelvra-execution-bundle-"));
const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
const child = spawn(
  process.execPath,
  [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: directory,
      WORKSPACE_ROOT: directory,
      NODE_ENV: "test",
      LOG_LEVEL: "info",
    },
    stdio: ["ignore", "pipe", "ignore"],
  },
);
const closed = new Promise((resolve) => child.once("exit", resolve));
let startup = "";
child.stdout.on("data", (chunk) => {
  startup = (startup + chunk.toString()).slice(-8192);
});
const deadline = Date.now() + 20000;
const pause = () => new Promise((resolve) => setTimeout(resolve, 50));
const base = `http://127.0.0.1:${port}/api`;
const post = async (path, data) => {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Bundled API failure ${response.status}`);
  return response.json();
};
try {
  while (!startup.includes("Server listening at")) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error("Bundled startup failed");
    await pause();
  }
  const { agent } = await post("/agents", {
    name: "Bundle Nova",
    role: "Disposable",
    providerId: "fake",
  });
  const { task } = await post("/tasks", { title: "Create landing page", assignee: agent.id });
  await post(`/tasks/${task.id}/execute`, {});
  let response;
  do {
    response = await (await fetch(base + `/tasks/${task.id}/execution`)).json();
    if (Date.now() > deadline) throw new Error("Bundled execution timed out");
    await pause();
  } while (
    ["queued", "starting", "running", "awaiting_result"].includes(response.execution.status)
  );
  const updated = await (await fetch(base + `/tasks/${task.id}`)).json();
  if (
    response.execution.status !== "succeeded" ||
    updated.task.status !== "review" ||
    !response.result.changedFiles.includes("fake-result.txt")
  )
    throw new Error("Bundled execution failed");
  if (
    (await readFile(
      join(directory, "hive/agents", agent.id, "workspace/fake-result.txt"),
      "utf8",
    )) !== "Create landing page\n"
  )
    throw new Error("Bundled workspace mismatch");
  console.log(
    JSON.stringify({
      bundledServer: true,
      bundledWorker: true,
      bundledFake: true,
      taskStatus: updated.task.status,
      structuredResult: true,
    }),
  );
} finally {
  child.kill("SIGINT");
  await closed;
  await rm(directory, { recursive: true, force: true });
  console.log("Bundled smoke stopped and temporary data removed.");
}
