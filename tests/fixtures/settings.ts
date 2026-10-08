import { loadConfig } from "../../apps/server/src/config/env";
import { settingsSnapshot } from "../../apps/server/src/routes/settings";
import { ProviderRegistry } from "../../apps/server/src/providers/provider-registry";
import { SERVER_VERSION } from "../../apps/server/src/version";

/** Real snapshot/discovery logic with explicit test configuration; no provider secrets or probes. */
export async function settingsFixture(production = false, host = "127.0.0.1") {
  const config = loadConfig({
    NODE_ENV: production ? "production" : "test",
    HOST: host,
    PORT: "3101",
    WEB_ORIGIN: "http://127.0.0.1:5174,http://localhost:5174",
    DATA_DIR: "/tmp/qelvra-settings-fixture/data",
    WORKSPACE_ROOT: "/tmp/qelvra-settings-fixture/workspace",
  });
  const registry = new ProviderRegistry({
    env: { PATH: "", SHELL: "/bin/sh" },
    allowFake: !production,
  });
  return {
    settings: settingsSnapshot(config, SERVER_VERSION),
    registry,
    providers: await registry.list(),
  };
}
