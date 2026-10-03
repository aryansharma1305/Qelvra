import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Agent } from "@qelvra/shared";
import type { CreatePtySessionOptions } from "../pty/types.js";
import { AgentError } from "./errors.js";

/** One fixed demo executable. No command, arguments or paths come from agent/API input. */
export function resolveRuntimeCommand(
  agent: Agent,
  dataDir: string,
  allowFake: boolean,
): CreatePtySessionOptions["command"] {
  if (agent.providerId === null) return undefined;
  if (agent.providerId !== "fake" || !allowFake)
    throw new AgentError("AGENT_INVALID_PROVIDER", "This agent provider is unavailable");
  // Bundled server and demo executable live together in dist. Source development uses
  // the installed tsx loader, explicitly selected by server code rather than a shell.
  const bundled = new URL("./fake-agent.js", import.meta.url);
  const args = existsSync(bundled)
    ? [fileURLToPath(bundled)]
    : [
        "--import",
        import.meta.resolve("tsx"),
        fileURLToPath(new URL("../fake-agent/cli.ts", import.meta.url)),
      ];
  return {
    file: process.execPath,
    args,
    env: { QELVRA_AGENT_ID: agent.id, QELVRA_DATA_DIR: dataDir },
  };
}
