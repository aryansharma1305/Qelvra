import { describe, expect, it } from "vitest";
import { ConfigError, isLoopbackHost, loadConfig } from "../../apps/server/src/config/env";

describe("server configuration", () => {
  it("defaults to loopback on port 3001 with the Vite dev origin", () => {
    expect(loadConfig({})).toEqual({
      host: "127.0.0.1",
      port: 3001,
      executionTimeoutMs: 1200000,
      orchestration: { maxTasks: 20, maxAttempts: 3, maxConcurrent: 3, timeoutMs: 3600000 },
      webOrigins: ["http://127.0.0.1:5173"],
      workspaceRoot: process.cwd(),
      dataDir: `${process.cwd()}/.qelvra`,
      logLevel: "info",
      isProduction: false,
      environment: "development",
    });
  });

  it("reads HOST, PORT and a comma-separated WEB_ORIGIN list", () => {
    const config = loadConfig({
      HOST: "::1",
      PORT: "4000",
      WEB_ORIGIN: "http://127.0.0.1:5173/, http://localhost:5173",
    });
    expect(config.host).toBe("::1");
    expect(config.port).toBe(4000);
    expect(config.webOrigins).toEqual(["http://127.0.0.1:5173", "http://localhost:5173"]);
  });

  it("resolves WORKSPACE_ROOT to an absolute path", () => {
    expect(loadConfig({ WORKSPACE_ROOT: "apps/server" }).workspaceRoot).toBe(
      `${process.cwd()}/apps/server`,
    );
  });

  it.each([
    [{ PORT: "0" }],
    [{ PORT: "70000" }],
    [{ PORT: "abc" }],
    [{ WEB_ORIGIN: "*" }],
    [{ WEB_ORIGIN: "file:///etc/passwd" }],
    [{ WEB_ORIGIN: " , " }],
    [{ LOG_LEVEL: "loud" }],
    [{ ORCHESTRATION_MAX_TASKS: "21" }],
    [{ ORCHESTRATION_MAX_ATTEMPTS: "4" }],
    [{ ORCHESTRATION_MAX_CONCURRENT: "0" }],
    [{ ORCHESTRATION_TIMEOUT_MS: "999" }],
    [{ EXECUTION_TIMEOUT_MS: "999" }],
    [{ EXECUTION_TIMEOUT_MS: "1800001" }],
    [{ EXECUTION_TIMEOUT_MS: "1.5" }],
    [{ EXECUTION_TIMEOUT_MS: "invalid" }],
  ])("rejects invalid input %o", (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it("identifies loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.1.10")).toBe(false);
  });
});
