import { mkdtempSync, mkdirSync, chmodSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderDetector,
  findExecutable,
  isExecutable,
  probeExecutable,
  type ProviderProbe,
} from "../../apps/server/src/providers/provider-detector";
import { PROVIDER_DEFINITIONS } from "../../apps/server/src/providers/provider-types";
const dirs: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "qelvra-provider-"));
  dirs.push(dir);
  const file = join(dir, "gemini");
  writeFileSync(file, "#!/bin/sh\nexit 0\n");
  chmodSync(file, 0o700);
  return { dir, file };
}
const gemini = required(PROVIDER_DEFINITIONS.find((d) => d.id === "gemini"));
function goodProbe(): ProviderProbe {
  return vi.fn(async (_file, args) => ({
    stdout: args[0] === "--version" ? "gemini 1.2.3" : "Usage: gemini [options]",
    stderr: "",
    exitCode: 0,
  }));
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
describe("safe provider detection", () => {
  it("finds a regular executable through absolute PATH directories", async () => {
    const { dir, file } = fixture();
    const probe = goodProbe();
    const result = await new ProviderDetector({ env: { PATH: dir }, probe }).detect(gemini);
    expect(result.executable).toBe(file);
    expect(result.provider).toMatchObject({
      id: "gemini",
      available: true,
      version: "1.2.3",
      auth: "unknown",
    });
    expect(probe).toHaveBeenCalledTimes(2);
  });
  it("reports a missing CLI without probing", async () => {
    const probe = goodProbe();
    const result = await new ProviderDetector({ env: { PATH: "/nonexistent" }, probe }).detect(
      gemini,
    );
    expect(result.provider).toMatchObject({ available: false, reason: "CLI_NOT_FOUND" });
    expect(probe).not.toHaveBeenCalled();
  });
  it("rejects directories, nonexecutables, relative names, NUL and unsafe PATH entries", () => {
    const { dir, file } = fixture();
    expect(isExecutable(dir)).toBe(false);
    chmodSync(file, 0o600);
    expect(isExecutable(file)).toBe(false);
    expect(isExecutable("relative")).toBe(false);
    expect(isExecutable("/tmp/\0evil")).toBe(false);
    expect(findExecutable(["gemini"], { PATH: `.:relative::${dir}` })).toBeNull();
    expect(findExecutable([file, "../gemini", "gemini;evil"], { PATH: dir })).toBeNull();
    mkdirSync(join(dir, "codex"));
    expect(findExecutable(["codex"], { PATH: dir })).toBeNull();
  });
  it.each([
    { exitCode: null, stdout: "1.2.3", stderr: "" },
    { exitCode: 2, stdout: "1.2.3", stderr: "secret" },
    { exitCode: 0, stdout: "unexpected private output", stderr: "" },
  ])("fails safely on timeout/nonzero/malformed version %#", async (result) => {
    const { dir } = fixture();
    const detector = new ProviderDetector({ env: { PATH: dir }, probe: vi.fn(async () => result) });
    expect((await detector.detect(gemini)).provider).toMatchObject({
      available: false,
      version: null,
      reason: "DETECTION_FAILED",
    });
  });
  it("isolates rejected process probes", async () => {
    const { dir } = fixture();
    expect(
      (
        await new ProviderDetector({
          env: { PATH: dir },
          probe: async () => {
            throw new Error("secret");
          },
        }).detect(gemini)
      ).provider.reason,
    ).toBe("DETECTION_FAILED");
  });
  it("rejects malformed or failing help", async () => {
    const { dir } = fixture();
    for (const help of [
      { stdout: "private value", stderr: "", exitCode: 0 },
      { stdout: "Usage:", stderr: "", exitCode: 1 },
    ]) {
      const probe: ProviderProbe = async (_file, args) =>
        args[0] === "--version" ? { stdout: "1.2.3", stderr: "", exitCode: 0 } : help;
      expect(
        (await new ProviderDetector({ env: { PATH: dir }, probe }).detect(gemini)).provider.reason,
      ).toBe("DETECTION_FAILED");
    }
  });
  it("extracts only a numeric version even from noisy output", async () => {
    const { dir } = fixture();
    const probe: ProviderProbe = async (_file, args) => ({
      stdout:
        args[0] === "--version" ? "secret private/path client version 1.2.3\nsecret" : "Usage:",
      stderr: "",
      exitCode: 0,
    });
    expect(
      (await new ProviderDetector({ env: { PATH: dir }, probe }).detect(gemini)).provider.version,
    ).toBe("1.2.3");
  });
  it("disables fake in production and enables only explicitly", async () => {
    const def = required(PROVIDER_DEFINITIONS.find((d) => d.id === "fake"));
    expect((await new ProviderDetector().detect(def)).provider).toMatchObject({
      available: false,
      reason: "DISABLED_IN_PRODUCTION",
    });
    expect((await new ProviderDetector({ allowFake: true }).detect(def)).provider.available).toBe(
      true,
    );
  });
  it("marks installed Ollama as needing model configuration", async () => {
    const def = { ...gemini, id: "ollama" as const };
    expect(
      (await new ProviderDetector({ env: { PATH: fixture().dir }, probe: goodProbe() }).detect(def))
        .provider,
    ).toMatchObject({ available: true, configured: false, reason: "CONFIGURATION_REQUIRED" });
  });
  it.each([true, false, null])(
    "reads only Claude's boolean authentication status (%s)",
    async (loggedIn) => {
      const def = { ...gemini, id: "claude-code" as const };
      const probe: ProviderProbe = async (_file, args) => ({
        stdout:
          args[0] === "--version"
            ? "2.1.287"
            : args[0] === "--help"
              ? "Usage: claude auth"
              : JSON.stringify({ loggedIn, apiKey: "secret", email: "private" }),
        stderr: "",
        exitCode: 0,
      });
      const result = await new ProviderDetector({ env: { PATH: fixture().dir }, probe }).detect(
        def,
      );
      expect(result.provider.auth).toBe(
        loggedIn === true ? "authenticated" : loggedIn === false ? "auth-required" : "unknown",
      );
      expect(JSON.stringify(result.provider)).not.toMatch(/secret|private/);
    },
  );
  it.each(["Logged in using ChatGPT", "Not logged in", "unexpected"])(
    'classifies Codex status "%s"',
    async (text) => {
      const def = { ...gemini, id: "codex" as const };
      const probe: ProviderProbe = async (_file, args) => ({
        stdout:
          args[0] === "--version" ? "0.160.0" : args[0] === "--help" ? "Usage: codex login" : text,
        stderr: "",
        exitCode: args[0] === "login" && /Not/.test(text) ? 1 : 0,
      });
      expect(
        (await new ProviderDetector({ env: { PATH: fixture().dir }, probe }).detect(def)).provider
          .auth,
      ).toBe(
        text.startsWith("Logged")
          ? "authenticated"
          : text.startsWith("Not")
            ? "auth-required"
            : "unknown",
      );
    },
  );
  it("does not launch Codex versions lacking the owned-process flag", async () => {
    const def = {
      ...required(PROVIDER_DEFINITIONS.find((d) => d.id === "codex")),
      executableCandidates: ["gemini"],
    };
    expect(
      (await new ProviderDetector({ env: { PATH: fixture().dir }, probe: goodProbe() }).detect(def))
        .provider.reason,
    ).toBe("DETECTION_FAILED");
  });
  it.skipIf(process.platform === "win32")(
    "times out even when a descendant holds pipes open, and kills that group",
    async () => {
      const result = await probeExecutable(
        process.execPath,
        [
          "-e",
          "const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore',process.stdout,process.stderr]}); console.log(c.pid); setInterval(()=>{},1000)",
        ],
        { PATH: dirname(process.execPath) },
      );
      expect(result.exitCode).toBeNull();
      const pid = Number(result.stdout.trim());
      expect(pid).toBeGreaterThan(0);
      await expect
        .poll(() => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        })
        .toBe(false);
    },
    6000,
  );
  it("bounds combined probe output and stops the process", async () => {
    const result = await probeExecutable(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(100000));setInterval(()=>{},1000)"],
      {},
    );
    expect(result.exitCode).toBeNull();
    expect(Buffer.byteLength(result.stdout + result.stderr)).toBeLessThanOrEqual(65536);
  });
  it("real probe has bounded output and terminates a stalled executable", async () => {
    const result = await probeExecutable(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      PATH: dirname(process.execPath),
    });
    expect(result.exitCode).toBeNull();
  }, 5000);
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing provider fixture value");
  return value;
}
