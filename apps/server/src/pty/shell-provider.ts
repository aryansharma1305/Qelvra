import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { PtyError } from "./errors.js";

/** The program a PTY runs. Chosen by the server, never by API input. */
export interface ResolvedShell {
  file: string;
  args: readonly string[];
}

/**
 * Decides what a new PTY executes. Local shells today; later providers (e.g. AI CLIs)
 * implement the same interface without touching PTY lifecycle code.
 */
export interface ShellProvider {
  readonly name: string;
  resolve(): ResolvedShell;
}

export const POSIX_SHELL_ALLOWLIST = [
  "/bin/zsh",
  "/bin/bash",
  "/bin/sh",
  "/usr/bin/zsh",
  "/usr/bin/bash",
  "/usr/bin/sh",
  "/bin/dash",
  "/usr/bin/dash",
  "/usr/local/bin/zsh",
  "/usr/local/bin/bash",
  "/opt/homebrew/bin/zsh",
  "/opt/homebrew/bin/bash",
] as const;

const POSIX_FALLBACKS = ["/bin/zsh", "/bin/bash", "/bin/sh"] as const;
const WINDOWS_SHELLS = ["pwsh.exe", "powershell.exe"] as const;

export interface LocalShellProviderOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  /** Start POSIX shells as login shells so the user's PATH (nvm, Homebrew, ...) applies. */
  login?: boolean;
  /** Restrict to these shells (each must also be on the built-in allowlist). */
  only?: readonly string[];
  isExecutable?: (file: string) => boolean;
}

function defaultIsExecutable(file: string): boolean {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function argsFor(file: string, login: boolean): string[] {
  if (!login) return [];
  return file.endsWith("/sh") ? [] : ["-l"];
}

/**
 * Prefers $SHELL when it is an allowlisted, executable absolute path; otherwise falls back
 * to /bin/zsh, /bin/bash, /bin/sh. On Windows uses pwsh, then Windows PowerShell.
 */
export function createLocalShellProvider(options: LocalShellProviderOptions = {}): ShellProvider {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const login = options.login ?? true;
  const isExecutable = options.isExecutable ?? defaultIsExecutable;

  return {
    name: "local-shell",
    resolve(): ResolvedShell {
      if (platform === "win32") {
        const dirs = (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
        for (const shell of WINDOWS_SHELLS) {
          const found = dirs.map((dir) => join(dir, shell)).find(isExecutable);
          if (found) return { file: found, args: ["-NoLogo"] };
        }
        throw new PtyError("PTY_NO_SHELL", "No supported shell (pwsh or powershell) was found");
      }

      const allowed = new Set<string>(
        options.only
          ? options.only.filter((s) => (POSIX_SHELL_ALLOWLIST as readonly string[]).includes(s))
          : POSIX_SHELL_ALLOWLIST,
      );
      const preferred = env.SHELL;
      const candidates = [
        ...(preferred && isAbsolute(preferred) ? [preferred] : []),
        ...(options.only ?? POSIX_FALLBACKS),
      ];
      for (const file of candidates) {
        if (allowed.has(file) && isExecutable(file)) return { file, args: argsFor(file, login) };
      }
      throw new PtyError("PTY_NO_SHELL", "No allowed shell is available on this system");
    },
  };
}
