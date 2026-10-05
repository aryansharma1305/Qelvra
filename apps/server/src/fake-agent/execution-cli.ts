// Fixed one-shot fake adapter. Same coordinator, mailbox transport and result handler as Codex.
import { fakeDecision } from "../providers/provider-orchestration.js";
import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { TaskExecutionRequestSchema } from "@qelvra/shared";
import type { ExecutionInput } from "../providers/provider-execution.js";
let input = "";
for await (const chunk of process.stdin) {
  input += String(chunk);
  if (Buffer.byteLength(input) > 131072) throw new Error("Oversized input");
}
const value = JSON.parse(input) as ExecutionInput;
const request = TaskExecutionRequestSchema.parse(value.request);
await new Promise((resolve) => setTimeout(resolve, 400));
if (!request.decision) {
  const file = await open(
    "fake-result.txt",
    constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    0o600,
  );
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1) throw new Error("Unsafe output file");
    await file.truncate(0);
    await file.writeFile(`${request.title}\n`);
  } finally {
    await file.close();
  }
}
process.stdout.write(
  JSON.stringify({
    executionId: request.executionId,
    requestMessageId: value.requestMessageId,
    taskId: request.taskId,
    agentId: request.agentId,
    status: "completed",
    summary: `Completed: ${request.title}`,
    changedFiles: request.decision ? [] : ["fake-result.txt"],
    notes: request.decision
      ? JSON.stringify(fakeDecision(request))
      : "Deterministic fake execution; no AI model was used.",
  }),
);
