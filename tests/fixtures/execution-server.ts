// Test-only composition: fixed fake fixture command. Never used by npm run dev/start.
import { fileURLToPath } from "node:url";
import { createApp } from "../../apps/server/src/app.js";
import { loadConfig } from "../../apps/server/src/config/env.js";
import { PROVIDER_DEFINITIONS, ProviderRegistry } from "../../apps/server/src/providers/index.js";
import { installShutdownHandlers } from "../../apps/server/src/server.js";
import { ExecutionProcessManager } from "../../apps/server/src/execution/index.js";
import type { ExecutionCommand } from "../../apps/server/src/providers/provider-execution.js";
class FixtureExecutionProcesses extends ExecutionProcessManager {
  override run(command: ExecutionCommand, signal: AbortSignal): Promise<string> {
    console.log(JSON.stringify({ fixtureDirectory: command.cleanupDirectory }));
    return super.run(command, signal);
  }
}
if (process.env.NODE_ENV !== "test") throw new Error("Execution fixture server is test-only");
const config = loadConfig();
const definitions = PROVIDER_DEFINITIONS.map((def) =>
  def.id === "fake"
    ? {
        ...def,
        execution: {
          args: [fileURLToPath(new URL("./execution-cli.mjs", import.meta.url)), "title"],
          input: "json" as const,
          output: "json" as const,
        },
      }
    : def,
);
const app = await createApp(config, {
  providerRegistry: new ProviderRegistry({ definitions, allowFake: true }),
  executionOptions: { timeoutMs: 10000, processes: new FixtureExecutionProcesses() },
});
await app.listen({
  host: config.host,
  port: process.env.QELVRA_TEST_PORT === "0" ? 0 : config.port,
});
installShutdownHandlers(app);
console.log(JSON.stringify({ fixturePort: (app.server.address() as { port: number }).port }));
