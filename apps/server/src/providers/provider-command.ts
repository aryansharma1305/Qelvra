import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Agent } from "@qelvra/shared";
import type { ProviderDefinition, ProviderCommand } from "./provider-types.js";
import { ProviderError } from "./provider-errors.js";
import { isExecutable } from "./provider-detector.js";
import { providerEnvironment } from "./provider-environment.js";
export { providerEnvironment, PROVIDER_ENV_KEYS } from "./provider-environment.js";
export function resolveProviderCommand(
  definition: ProviderDefinition,
  executable: string,
  agent: Agent,
  cwd: string,
  dataDir: string,
  source: NodeJS.ProcessEnv,
): ProviderCommand {
  if (!isExecutable(executable))
    throw new ProviderError(
      "PROVIDER_EXECUTABLE_NOT_FOUND",
      `${definition.name} executable is no longer available. Refresh provider availability.`,
    );
  const env = providerEnvironment(source);
  let args = [...definition.args];
  if (definition.id === "fake") {
    // Source and bundled server both use this resolver, through the same registry.
    const bundled = new URL("./fake-agent.js", import.meta.url);
    args = existsSync(bundled)
      ? [fileURLToPath(bundled)]
      : [
          "--import",
          import.meta.resolve("tsx"),
          fileURLToPath(new URL("../fake-agent/cli.ts", import.meta.url)),
        ];
    env.QELVRA_AGENT_ID = agent.id;
    env.QELVRA_DATA_DIR = dataDir;
  }
  return { file: executable, args, cwd, env, inheritEnv: false };
}
