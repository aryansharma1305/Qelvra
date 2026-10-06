import { StartupValidationError } from "./release/startup-validation.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { AgentRegistryLoadError } from "./agents/index.js";
import { ConfigError, loadConfig } from "./config/env.js";
import { installShutdownHandlers, startServer } from "./server.js";

/** Loads ./.env without overriding variables that are already set. */
function loadDotEnv(file = resolve(process.cwd(), ".env")): void {
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  const app = await startServer(config);
  installShutdownHandlers(app);
}

main().catch((error: unknown) => {
  // The logger may not exist yet (e.g. invalid config), so report to stderr directly.
  const message =
    error instanceof ConfigError ||
    error instanceof AgentRegistryLoadError ||
    error instanceof StartupValidationError
      ? error.message
      : error;
  console.error("Failed to start server:", message);
  process.exit(1);
});
