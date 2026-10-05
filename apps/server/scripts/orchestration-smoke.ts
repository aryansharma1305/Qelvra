// Local-only real Codex orchestrator + deterministic fake workers. Disposable data, no Kite changes.
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
async function fingerprint() {
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
const before = await fingerprint();
const directory = await mkdtemp(join(tmpdir(), "qelvra-orchestration-smoke-"));
const app = await createApp(
  loadConfig({
    DATA_DIR: directory,
    WORKSPACE_ROOT: directory,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  }),
  {
    logger: false,
    executionOptions: { timeoutMs: 180000 },
    orchestrationOptions: { timeoutMs: 600000 },
  },
);
try {
  await app.ready();
  const provider = await app.providers.get(providerId);
  console.log(
    JSON.stringify({
      provider: providerId,
      version: provider.version,
      automation: provider.capabilities.automation,
      auth: provider.auth,
    }),
  );
  for (const [id, role, provider] of [
    ["smoke-michael", "Orchestrator", providerId],
    ["smoke-nova", "Frontend Engineer", "fake"],
    ["smoke-atlas", "Backend Engineer", "fake"],
  ] as const)
    await app.runtime.create({ id, name: id, role, providerId: provider });
  const goal = await app.orchestration.create({
    title: "Build frontend and backend",
    description:
      "This is a tiny coordination verification. Generate exactly two independent tasks, preferredRole Frontend Engineer and Backend Engineer. Workers are deterministic fake providers: each writes fake-result.txt in its own workspace and returns a correlated successful result. Review that bounded result contract; do not require a real integrated application, inspect other workspaces or ask for a build. Approve successful fake results. Summarize only the supplied task IDs, agent IDs and changed-file claims. Workspaces stay separate. Do not edit any files in the orchestrator workspace.",
    orchestratorAgentId: "smoke-michael",
  });
  await app.orchestration.plan(goal.id);
  const wait = async (status: string) => {
    const deadline = Date.now() + 600000;
    for (;;) {
      const current = app.orchestration.get(goal.id);
      if (current.status === status) return current;
      if (["failed", "cancelled", "paused"].includes(current.status))
        throw new Error(current.errorCode ?? current.status);
      if (Date.now() > deadline) throw new Error("Smoke deadline exceeded");
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  const plan = await wait("planned");
  if (plan.plan?.tasks.length !== 2 || plan.taskIds.length)
    throw new Error("Expected two tasks awaiting explicit approval");
  console.log(
    JSON.stringify({
      status: "planned",
      taskCount: plan.plan.tasks.length,
      workerTasksBeforeApproval: plan.taskIds.length,
    }),
  );
  await app.orchestration.run(goal.id);
  const completed = await wait("completed");
  if (
    completed.taskIds.length !== 2 ||
    !completed.finalSummary ||
    !completed.taskIds.every((id) => app.tasks.require(id).status === "completed")
  )
    throw new Error("Missing completed tasks or summary");
  for (const slot of completed.tasks) {
    const cwd = await app.workspaces.getWorkspacePath(slot.agentId);
    if (
      !(await readFile(join(cwd, "fake-result.txt"), "utf8")).includes(
        app.tasks.require(slot.taskId).title,
      )
    )
      throw new Error("Workspace artifact mismatch");
    if (
      slot.review?.decision !== "approve" ||
      !slot.result?.changedFiles.includes("fake-result.txt")
    )
      throw new Error("Missing reviewed correlated result");
  }
  if (app.execution.size || app.pty.size) throw new Error("Process cleanup incomplete");
  if ((await app.mailbox.listMessages("system", "inbox")).messages.length)
    throw new Error("Stuck control message");
  console.log(
    JSON.stringify({
      status: "completed",
      tasks: 2,
      decisionProvider: providerId,
      workerProvider: "fake",
      summaryValidated: true,
      workspaceArtifactsVerified: true,
      processes: app.execution.size,
      ptys: app.pty.size,
    }),
  );
  if (before !== (await fingerprint())) throw new Error("Project files changed during smoke");
  console.log("Project file fingerprint unchanged.");
} finally {
  await app.close();
  await rm(directory, { recursive: true, force: true });
  console.log("Orchestration smoke: disposable data removed; processes stopped.");
}
