import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { probeExecutable, type ProviderProbe } from "./provider-probe.js";
export { probeExecutable, type ProviderProbe, type ProbeResult } from "./provider-probe.js";
import type { Provider } from "@qelvra/shared";
import { createLocalShellProvider } from "../pty/shell-provider.js";
import type { ProviderDefinition, ProviderDetection } from "./provider-types.js";
import { providerEnvironment } from "./provider-environment.js";
export function isExecutable(file: string, platform = process.platform): boolean {
  if (!file || !isAbsolute(file) || file.includes("\0")) return false;
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
export function findExecutable(
  names: readonly string[],
  env: NodeJS.ProcessEnv,
  platform = process.platform,
): string | null {
  const dirs = (env.PATH ?? env.Path ?? "")
    .split(platform === "win32" ? ";" : delimiter)
    .filter((d) => d && isAbsolute(d));
  for (const name of names) {
    if (!/^[a-zA-Z0-9_-]+(?:\.exe)?$/.test(name)) continue;
    const candidates = platform === "win32" && !name.endsWith(".exe") ? [`${name}.exe`] : [name];
    for (const dir of dirs)
      for (const candidate of candidates) {
        const file = join(dir, candidate);
        if (isExecutable(file, platform)) return file;
      }
  }
  return null;
}
export interface DetectorOptions {
  env?: NodeJS.ProcessEnv;
  allowFake?: boolean;
  probe?: ProviderProbe;
}
export class ProviderDetector {
  readonly env: NodeJS.ProcessEnv;
  private readonly probe: ProviderProbe;
  constructor(private readonly options: DetectorOptions = {}) {
    this.env = { ...(options.env ?? process.env) };
    this.probe = options.probe ?? probeExecutable;
  }
  async detect(def: ProviderDefinition): Promise<ProviderDetection> {
    const provider: Provider = {
      id: def.id,
      name: def.name,
      kind: def.kind,
      capabilities: { ...def.capabilities },
      available: false,
      version: null,
      reason: null,
      auth: def.capabilities.requiresAuth ? "unknown" : "not-required",
      configured: def.id !== "ollama",
    };
    const fail = (reason: Provider["reason"]): ProviderDetection => ({
      provider: { ...provider, reason },
      executable: null,
    });
    if (def.id === "fake")
      return this.options.allowFake
        ? { provider: { ...provider, available: true }, executable: process.execPath }
        : fail("DISABLED_IN_PRODUCTION");
    if (def.id === "shell") {
      try {
        const shell = createLocalShellProvider({ env: this.env, login: false }).resolve();
        return { provider: { ...provider, available: true }, executable: shell.file };
      } catch {
        return fail("CLI_NOT_FOUND");
      }
    }
    const executable = findExecutable(def.executableCandidates, this.env);
    if (!executable) return fail("CLI_NOT_FOUND");
    const env = providerEnvironment(this.env);
    try {
      const version = await this.probe(executable, ["--version"], env);
      // Only a bounded numeric version crosses the API boundary; never raw CLI output.
      const match = `${version.stdout}\n${version.stderr}`.match(
        /\b\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?\b/,
      );
      if (version.exitCode !== 0 || !match) return fail("DETECTION_FAILED");
      provider.version = match[0].slice(0, 64);
      const help = await this.probe(executable, ["--help"], env);
      if (
        help.exitCode !== 0 ||
        !/usage|commands|options/i.test(help.stdout + help.stderr) ||
        def.requiredHelp?.some((flag) => !(help.stdout + help.stderr).includes(flag))
      )
        return fail("DETECTION_FAILED");
      if (def.id === "codex" && /login/.test(help.stdout)) {
        const auth = await this.probe(executable, ["login", "status"], env);
        const text = auth.stdout + auth.stderr;
        if (/not logged in/i.test(text)) provider.auth = "auth-required";
        else if (auth.exitCode === 0 && /logged in/i.test(text)) provider.auth = "authenticated";
      }
      if (def.id === "claude-code" && /auth/.test(help.stdout)) {
        const auth = await this.probe(executable, ["auth", "status", "--json"], env);
        try {
          const value = JSON.parse(auth.stdout) as { loggedIn?: unknown };
          if (typeof value.loggedIn === "boolean")
            provider.auth = value.loggedIn
              ? auth.exitCode === 0
                ? "authenticated"
                : "unknown"
              : "auth-required";
        } catch {
          /* Unknown auth never fabricates login status. */
        }
      }
      provider.available = true;
      provider.reason = !provider.configured
        ? "CONFIGURATION_REQUIRED"
        : provider.auth === "auth-required"
          ? "AUTH_REQUIRED"
          : null;
      return { provider, executable };
    } catch {
      return fail("DETECTION_FAILED");
    }
  }
}
