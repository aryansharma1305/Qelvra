import { describe, expect, it } from "vitest";
import { PtyError, createLocalShellProvider } from "../../apps/server/src/pty/index";

const existing =
  (...files: string[]) =>
  (file: string) =>
    files.includes(file);

describe("local shell provider", () => {
  it("uses $SHELL when it is allowlisted and executable, as a login shell", () => {
    const provider = createLocalShellProvider({
      platform: "darwin",
      env: { SHELL: "/bin/bash" },
      isExecutable: existing("/bin/bash", "/bin/zsh"),
    });
    expect(provider.resolve()).toEqual({ file: "/bin/bash", args: ["-l"] });
  });

  it.each([
    ["not on the allowlist", "/usr/local/bin/fish"],
    ["an arbitrary program", "/tmp/evil.sh"],
    ["relative", "zsh"],
    ["traversal into an allowed name", "/tmp/../bin/zsh/../../tmp/evil"],
  ])("falls back to /bin/zsh when $SHELL is %s", (_label, shell) => {
    const provider = createLocalShellProvider({
      platform: "linux",
      env: { SHELL: shell },
      isExecutable: () => true,
    });
    expect(provider.resolve().file).toBe("/bin/zsh");
  });

  it("falls back through zsh, bash, sh by availability", () => {
    const resolve = (...available: string[]) =>
      createLocalShellProvider({
        platform: "linux",
        env: {},
        isExecutable: existing(...available),
      }).resolve();
    expect(resolve("/bin/bash", "/bin/sh").file).toBe("/bin/bash");
    expect(resolve("/bin/sh")).toEqual({ file: "/bin/sh", args: [] });
  });

  it("can be restricted to a subset and run without a login shell", () => {
    const provider = createLocalShellProvider({
      platform: "darwin",
      env: { SHELL: "/bin/zsh" },
      only: ["/bin/sh"],
      login: false,
      isExecutable: () => true,
    });
    expect(provider.resolve()).toEqual({ file: "/bin/sh", args: [] });
  });

  it("ignores restrictions to shells outside the allowlist", () => {
    const provider = createLocalShellProvider({
      platform: "darwin",
      env: {},
      only: ["/usr/bin/python3"],
      isExecutable: () => true,
    });
    expect(() => provider.resolve()).toThrow(PtyError);
  });

  it("fails with PTY_NO_SHELL when nothing is available", () => {
    const provider = createLocalShellProvider({
      platform: "linux",
      env: {},
      isExecutable: () => false,
    });
    expect(() => provider.resolve()).toThrow(expect.objectContaining({ code: "PTY_NO_SHELL" }));
  });

  it("prefers pwsh, then Windows PowerShell, from PATH on Windows", () => {
    const pathEnv = { PATH: "C:\\Windows\\System32;C:\\Program Files\\PowerShell\\7" };
    const withPwsh = createLocalShellProvider({
      platform: "win32",
      env: pathEnv,
      isExecutable: (f) => f.endsWith("pwsh.exe") || f.endsWith("powershell.exe"),
    });
    expect(withPwsh.resolve().file).toMatch(/pwsh\.exe$/);
    const legacyOnly = createLocalShellProvider({
      platform: "win32",
      env: pathEnv,
      isExecutable: (f) => f.endsWith("powershell.exe"),
    });
    expect(legacyOnly.resolve().file).toMatch(/powershell\.exe$/);
  });
});

describe("PTY environment", () => {
  it("drops the parent terminal's identity and sets our own TERM", async () => {
    const { ptyEnvironment } = await import("../../apps/server/src/pty/index");
    const env = ptyEnvironment({
      PATH: "/usr/bin",
      HOME: "/home/me",
      TERM: "dumb",
      TERM_PROGRAM: "Apple_Terminal",
      TERM_SESSION_ID: "w0t0p0:ABC",
      ITERM_SESSION_ID: "x",
      LC_TERMINAL: "iTerm2",
    });
    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/me",
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    });
  });
});
