import { useServerHealth, type ServerConnection } from "../../hooks/useServerHealth";

// Replaces the design's static "● ONLINE" in the sidebar footer, keeping its styling.
const PRESENTATION: Record<
  ServerConnection["state"],
  { label: string; text: string; dot: string }
> = {
  checking: { label: "CHECKING", text: "text-outline", dot: "bg-outline animate-pulse" },
  connected: { label: "CONNECTED", text: "text-tertiary", dot: "bg-tertiary" },
  disconnected: { label: "DISCONNECTED", text: "text-error", dot: "bg-error" },
};

function describe(connection: ServerConnection): string {
  switch (connection.state) {
    case "connected":
      return `Server v${connection.health.version} responded at ${connection.health.timestamp}`;
    case "disconnected":
      return connection.reason;
    default:
      return "Checking server connection…";
  }
}

export function ConnectionStatus() {
  const connection = useServerHealth();
  const { label, text, dot } = PRESENTATION[connection.state];
  return (
    <span
      className={`${text} flex items-center gap-1`}
      role="status"
      aria-live="polite"
      title={describe(connection)}
      data-connection={connection.state}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
