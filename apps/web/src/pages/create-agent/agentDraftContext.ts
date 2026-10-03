import { createContext, useContext } from "react";
import type { AgentDraft } from "./agentDraft";

export interface AgentDraftContextValue {
  draft: AgentDraft;
  update: (patch: Partial<AgentDraft>) => void;
}

export const AgentDraftContext = createContext<AgentDraftContextValue | null>(null);

export function useAgentDraft(): AgentDraftContextValue {
  const value = useContext(AgentDraftContext);
  if (!value) throw new Error("useAgentDraft must be used inside the Create Agent wizard");
  return value;
}
