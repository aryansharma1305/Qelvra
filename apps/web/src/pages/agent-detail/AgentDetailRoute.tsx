import { AgentIdSchema } from "@qelvra/shared";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAgent } from "../../features/agents/useAgent";
import { EmptyStatePage } from "../EmptyStatePage";
import { AgentDetailPage } from "./AgentDetailPage";

const BUTTON =
  "px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm";

function NotFound() {
  return (
    <EmptyStatePage
      title="Agent not found"
      icon="person_off"
      description="No agent with this id exists in the workspace."
      label={null}
      action={
        <Link to="/agents" className={BUTTON}>
          Back to agents
        </Link>
      }
    />
  );
}

export function AgentDetailRoute() {
  const { agentId = "" } = useParams();
  // Unsafe ids never reach the API.
  return AgentIdSchema.safeParse(agentId).success ? <AgentLoader id={agentId} /> : <NotFound />;
}

function AgentLoader({ id }: { id: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const lookup = useAgent(id, reloadKey);

  switch (lookup.status) {
    case "loading":
      return (
        <EmptyStatePage title="Loading agent" icon="hourglass_empty" description="" label={null} />
      );
    case "not_found":
      return <NotFound />;
    case "error":
      return (
        <EmptyStatePage
          title="Could not load agent"
          icon="cloud_off"
          description={lookup.message}
          label={null}
          action={
            <button type="button" className={BUTTON} onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          }
        />
      );
    case "found":
      return <AgentDetailPage agent={lookup.agent} />;
  }
}
