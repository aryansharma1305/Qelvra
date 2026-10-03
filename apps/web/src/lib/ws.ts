import { apiBaseUrl } from "./api";

/** Maps an http(s) base URL and path to the matching ws(s) URL. */
export function toWebSocketUrl(httpBaseUrl: string, path: string): string {
  const url = new URL(path, httpBaseUrl.endsWith("/") ? httpBaseUrl : `${httpBaseUrl}/`);
  if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol === "https:") url.protocol = "wss:";
  else throw new Error(`Unsupported API URL protocol: ${url.protocol}`);
  return url.toString();
}

export const TERMINAL_SOCKET_PATH = "/ws/terminal";

/** WebSocket endpoint for the browser terminal, derived from VITE_API_URL. */
export function terminalSocketUrl(baseUrl: string = apiBaseUrl): string {
  return toWebSocketUrl(baseUrl, TERMINAL_SOCKET_PATH);
}

/** WebSocket endpoint for a running agent's terminal. */
export function agentTerminalSocketUrl(agentId: string, baseUrl: string = apiBaseUrl): string {
  return toWebSocketUrl(baseUrl, `/ws/agents/${encodeURIComponent(agentId)}/terminal`);
}
