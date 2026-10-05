import type { Provider, ProviderId } from "@qelvra/shared";
export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  kind: Provider["kind"];
  capabilities: Provider["capabilities"];
  executableCandidates: readonly string[];
  args: readonly string[];
  requiredHelp?: readonly string[];
  execution?: { args: readonly string[]; input: "json" | "prompt"; output: "json" | "file" };
}
export interface ProviderDetection {
  provider: Provider;
  executable: string | null;
}
export interface ProviderCommand {
  file: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  inheritEnv: false;
}
const capabilities = (
  local: boolean,
  requiresAuth: boolean,
  automation = false,
): Provider["capabilities"] => ({
  interactive: true,
  automation,
  local,
  requiresAuth,
  supportsWorkspace: true,
});
/** Fixed definitions. No browser or agent field can supply executable names or argv. */
export const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    id: "shell",
    name: "Local shell",
    kind: "shell",
    capabilities: capabilities(true, false),
    executableCandidates: [],
    args: [],
  },
  {
    id: "fake",
    name: "Fake agent (development)",
    kind: "fake",
    capabilities: capabilities(true, false, true),
    execution: { args: [], input: "json", output: "json" },
    executableCandidates: [],
    args: [],
  },
  {
    id: "ollama",
    name: "Ollama",
    kind: "cli",
    capabilities: capabilities(true, false),
    executableCandidates: ["ollama"],
    args: [],
  },
  {
    id: "codex",
    name: "Codex",
    kind: "cli",
    capabilities: capabilities(false, true, true),
    execution: {
      args: [
        "--no-daemon",
        "--ask-for-approval",
        "never",
        "exec",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "--ephemeral",
        "--color",
        "never",
      ],
      input: "prompt",
      output: "file",
    },
    executableCandidates: ["codex"],
    args: ["--no-daemon", "--sandbox", "workspace-write", "--ask-for-approval", "on-request"],
    requiredHelp: ["--no-daemon", "--sandbox", "--ask-for-approval"],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    kind: "cli",
    capabilities: capabilities(false, true),
    executableCandidates: ["gemini"],
    args: [],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "cli",
    capabilities: capabilities(false, true),
    executableCandidates: ["claude"],
    args: [],
  },
  {
    id: "opencode",
    name: "OpenCode",
    kind: "cli",
    capabilities: capabilities(false, true),
    executableCandidates: ["opencode"],
    args: [],
  },
];
