// Server-selected test adapter: scenario directives are never recognized by production providers.
import { readFile, writeFile } from "node:fs/promises";
import { fakeDecision } from "../../apps/server/src/providers/provider-orchestration.js";
import type { ExecutionInput } from "../../apps/server/src/providers/provider-execution.js";
let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
  if (Buffer.byteLength(raw) > 131072) process.exit(2);
}
const input = JSON.parse(raw) as ExecutionInput,
  request = input.request;
const context = request.decision ? JSON.parse(request.decision.context) : null;
const mode = /\[fixture:(\w+)\]/.exec(context?.goal.title ?? request.title)?.[1] ?? "success";
await new Promise((r) => setTimeout(r, mode === "parallel" ? 1200 : 150));
let notes = "Fixture result",
  summary = `Completed: ${request.title}`,
  changedFiles: string[] = [];
if (request.decision) {
  if (mode === "planninghang" && request.decision.phase === "plan")
    await new Promise(() => {
      setInterval(() => {}, 1000);
    });
  let decision = fakeDecision(request);
  if (request.decision.phase === "plan") {
    const plan = decision as { tasks: { key: string; title: string; dependsOn: string[] }[] };
    for (const t of plan.tasks) t.title = `[fixture:${mode}] ${t.title}`;
    if (mode === "dependency")
      (
        plan.tasks[1] ??
        (() => {
          throw new Error("Missing backend fixture");
        })()
      ).dependsOn = ["frontend"];
    if (["rework", "limit", "failure", "cancel", "invalidworker"].includes(mode))
      plan.tasks = plan.tasks.slice(0, 1);
    if (mode === "invalidplan")
      decision = { summary: "Invalid", tasks: [{ key: "x", command: "rm -rf /" }] };
  }
  if (
    request.decision.phase === "review" &&
    (mode === "limit" || (mode === "rework" && context.attempt === 1))
  )
    decision = {
      decision: "rework",
      reason: "Missing the requested detail",
      reworkInstructions: "Add the requested detail and return a new result.",
    };
  if (request.decision.phase === "review" && mode === "invalidreview")
    decision = {
      decision: "approve",
      reason: "Good",
      reworkInstructions: null,
      command: "rm -rf /",
    };
  if (request.decision.phase === "summary" && mode === "invalidsummary")
    decision = {
      ...(decision as object),
      completedTasks: ["task-00000000-0000-4000-8000-000000000001"],
    };
  notes = JSON.stringify(decision);
} else {
  let count = 0;
  try {
    count = Number(await readFile("fixture-attempts.txt", "utf8"));
  } catch {
    /* first attempt */
  }
  await writeFile("fixture-attempts.txt", String(count + 1));
  if (mode === "cancel")
    await new Promise(() => {
      setInterval(() => {}, 1000);
    });
  if (mode === "failure" && count === 0) process.exit(1);
  if (mode === "invalidworker") {
    process.stdout.write("not-json");
    process.exit(0);
  }
  await writeFile("fake-result.txt", request.title);
  changedFiles = ["fake-result.txt"];
  if (mode === "rework" && count === 0) summary = "Missing requested detail";
}
process.stdout.write(
  JSON.stringify({
    executionId: request.executionId,
    requestMessageId: input.requestMessageId,
    taskId: request.taskId,
    agentId: request.agentId,
    status: "completed",
    summary,
    changedFiles,
    notes,
  }),
);
