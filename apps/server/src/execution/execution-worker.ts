// Fixed server-owned watchdog, not an agent and not an externally addressable service.
import { ExecutionChildProcess } from "./execution-process-manager.js";
import type { ExecutionCommand } from "../providers/provider-execution.js";
import { ExecutionError } from "./execution-errors.js";
import { ProviderError } from "../providers/provider-errors.js";
import { rm } from "node:fs/promises";
const controller = new AbortController();
let running = false;
const cancel = () => {
  controller.abort("EXECUTION_INTERRUPTED");
  if (!running) process.exit(0);
};
process.on("disconnect", cancel);
process.on("SIGTERM", cancel);
process.on("SIGINT", cancel);
process.on("message", (raw) => {
  const message = raw as {
    type: string;
    command: ExecutionCommand;
    maxBytes: number;
    code: string;
  };
  if (message.type === "cancel") {
    controller.abort(message.code);
    return;
  }
  if (running || message.type !== "run") return;
  running = true;
  void (async () => {
    let response: { output?: string; code?: string };
    try {
      response = {
        output: await new ExecutionChildProcess(message.maxBytes).run(
          message.command,
          controller.signal,
        ),
      };
    } catch (error) {
      response = {
        code:
          error instanceof ExecutionError || error instanceof ProviderError
            ? error.code
            : "EXECUTION_START_FAILED",
      };
    }
    if (process.connected) process.send?.(response, () => process.exit(0));
    else {
      if (message.command.cleanupDirectory)
        await rm(message.command.cleanupDirectory, { recursive: true, force: true });
      process.exit(0);
    }
  })();
});
