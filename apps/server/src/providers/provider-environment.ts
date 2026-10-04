/** No API keys, server configuration, NODE_OPTIONS, loader or injection variables. */
export const PROVIDER_ENV_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SystemRoot",
  "WINDIR",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PATHEXT",
] as const;
export function providerEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of PROVIDER_ENV_KEYS) if (source[key] !== undefined) env[key] = source[key];
  if (!env.PATH && source.Path) env.PATH = source.Path;
  env.TERM = "xterm-256color";
  return env;
}
