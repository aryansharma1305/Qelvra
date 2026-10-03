export { PTY_ERROR_CODES, PtyError, type PtyErrorCode } from "./errors.js";
export {
  PTY_DEFAULT_COLS,
  PTY_DEFAULT_ROWS,
  PTY_MAX_COLS,
  PTY_MAX_ROWS,
  PTY_TERM_NAME,
  PtyManager,
  ptyEnvironment,
  type PtyManagerOptions,
} from "./pty-manager.js";
export {
  POSIX_SHELL_ALLOWLIST,
  createLocalShellProvider,
  type LocalShellProviderOptions,
  type ResolvedShell,
  type ShellProvider,
} from "./shell-provider.js";
export type {
  CreatePtySessionOptions,
  Disposable,
  PtyExit,
  PtyLogger,
  PtySessionInfo,
  PtySessionStatus,
} from "./types.js";
