import process from "node:process";
import { Buffer } from "node:buffer";
import { setInterval, setTimeout } from "node:timers";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
let raw = "";
for await (const data of process.stdin) {
  raw += data;
  if (Buffer.byteLength(raw) > 131072) process.exit(2);
}
const input = JSON.parse(raw);
const request = input.request;
if (request.decision) {
  const { fakeDecision } =
    await import("../../apps/server/src/providers/provider-orchestration.ts");
  const context = JSON.parse(request.decision.context);
  const scenario = /\[fixture:(\w+)\]/.exec(context.goal.title)?.[1];
  let decision = fakeDecision(request);
  if (scenario === "rework") {
    if (request.decision.phase === "plan") {
      decision.tasks = decision.tasks.slice(0, 1);
      decision.tasks[0].title = "[fixture:rework] Build frontend";
    }
    if (request.decision.phase === "review" && context.attempt === 1)
      decision = {
        decision: "rework",
        reason: "Add the requested detail",
        reworkInstructions: "Add the requested detail and return a fresh result.",
      };
  }
  if (scenario === "timeout" && request.decision.phase === "plan") {
    decision.tasks = decision.tasks.slice(0, 1);
    decision.tasks[0].title = "[fixture:timeout] Crash frontend";
  }
  await new Promise((r) => setTimeout(r, 600));
  process.stdout.write(
    JSON.stringify({
      executionId: request.executionId,
      requestMessageId: input.requestMessageId,
      taskId: request.taskId,
      agentId: request.agentId,
      status: "completed",
      summary: "Structured decision",
      changedFiles: [],
      notes: JSON.stringify(decision),
    }),
  );
  process.exit(0);
}
const mode =
  process.argv[2] === "title"
    ? (/^\[fixture:(\w+)\]/.exec(request.title)?.[1] ?? "success")
    : (process.argv[2] ?? "success");
const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
await writeFile(
  "fixture-process.json",
  JSON.stringify({
    pid: process.pid,
    childPid: child.pid,
    cwd: process.cwd(),
    secretPresent: !!process.env.UNRELATED_SECRET,
    loaderPresent: !!process.env.NODE_OPTIONS,
  }),
);
if (mode === "timeout") {
  setInterval(() => {}, 1000);
} else if (mode === "large") {
  setInterval(() => process.stdout.write("x".repeat(65536)), 1);
} else {
  await new Promise((r) => setTimeout(r, process.argv[2] === "title" ? 1500 : 150));
  if (mode === "auth") {
    process.stderr.write("Authentication required PRIVATE_SECRET_MARKER");
    process.exitCode = 1;
  } else if (mode === "exit") process.exitCode = 1;
  else if (mode === "invalid")
    process.stdout.write("QELVRA_RESULT_START\nnot-json\nQELVRA_RESULT_END");
  else {
    await writeFile("fixture.txt", "HELLO_QELVRA");
    process.stdout.write(
      JSON.stringify({
        executionId: request.executionId,
        requestMessageId: input.requestMessageId,
        taskId: request.taskId,
        agentId: request.agentId,
        status: mode === "failure" ? "failed" : "completed",
        summary: `Completed: ${request.title}`,
        changedFiles: mode === "traversal" ? ["../../etc/passwd"] : ["fixture.txt"],
        notes: "Deterministic execution fixture.",
      }),
    );
  }
  // Leave the descendant for the execution manager's dedicated tree cleanup.
  child.unref();
}
