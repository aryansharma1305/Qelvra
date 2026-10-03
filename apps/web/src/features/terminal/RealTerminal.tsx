import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { TerminalCreatedMessage } from "@qelvra/shared";
import { useEffect, useLayoutEffect, useRef } from "react";
import { agentTerminalSocketUrl, terminalSocketUrl } from "../../lib/ws";
import { TerminalConnection, type TerminalConnectionState } from "./terminal-client";

export interface TerminalStatus {
  state: TerminalConnectionState;
  session: TerminalCreatedMessage | null;
  cols: number;
  rows: number;
}

interface RealTerminalProps {
  /** Attach to this running agent's shell; without it, a new scratch shell is created. */
  agentId?: string;
  onStatusChange?: (status: TerminalStatus) => void;
}

const FONT_FAMILY = '"JetBrains Mono", ui-monospace, monospace';
const FONT_SIZE = 11; // design token code-sm
const SCROLLBACK_LINES = 5_000;
const RESIZE_DEBOUNCE_MS = 50;

// Palette from the Stitch design tokens (tailwind.config.ts).
const THEME: ITheme = {
  background: "#0e0e10",
  foreground: "#cbc3d7",
  cursor: "#d0bcff",
  cursorAccent: "#0e0e10",
  selectionBackground: "rgba(208, 188, 255, 0.25)",
  black: "#131315",
  red: "#ffb4ab",
  green: "#4edea3",
  yellow: "#f2ca50",
  blue: "#4cd7f6",
  magenta: "#d0bcff",
  cyan: "#acedff",
  white: "#e5e1e4",
  brightBlack: "#958ea0",
  brightRed: "#ffdad6",
  brightGreen: "#6ffbbe",
  brightYellow: "#ffe08a",
  brightBlue: "#acedff",
  brightMagenta: "#e9ddff",
  brightCyan: "#acedff",
  brightWhite: "#ffffff",
};

/**
 * A live shell: xterm.js in the browser, a PTY on the server, a WebSocket in between.
 * Scratch mode: mounting starts a fresh shell and unmounting ends it. Agent mode: mounting
 * attaches to the agent's running shell and unmounting only detaches (the agent keeps
 * running). Remount (change the key) to reconnect.
 */
export function RealTerminal({ agentId, onStatusChange }: RealTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  useLayoutEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let resizeTimer: number | undefined;
    const status: TerminalStatus = { state: "connecting", session: null, cols: 0, rows: 0 };
    const publish = (patch: Partial<TerminalStatus>) => {
      Object.assign(status, patch);
      onStatusChangeRef.current?.({ ...status });
    };

    const terminal = new Terminal({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      lineHeight: 1.45,
      scrollback: SCROLLBACK_LINES,
      cursorBlink: true,
      theme: THEME,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);

    const url = agentId ? agentTerminalSocketUrl(agentId) : terminalSocketUrl();
    const connection = new TerminalConnection(url, {
      onState: (state) => {
        publish({ state });
        terminal.options.disableStdin = state !== "connected";
        if (state === "connected" && agentId) {
          // No backend scrollback: only output produced from now on is shown.
          terminal.write("\x1b[2m[live session — earlier output is not shown]\x1b[0m\r\n");
        }
        if (state === "disconnected") {
          terminal.write("\r\n\x1b[2m[disconnected from server]\x1b[0m\r\n");
        }
      },
      onCreated: (session) => publish({ session }),
      // Raw bytes from the PTY, ANSI sequences included; xterm renders them.
      onOutput: (data) => terminal.write(data),
      onExit: ({ exitCode, signal }) => {
        const reason = signal ? `signal ${signal}` : `code ${exitCode}`;
        terminal.write(`\r\n\x1b[2m[process exited with ${reason}]\x1b[0m\r\n`);
      },
      onError: (error) => {
        terminal.write(`\r\n\x1b[31m[${error.message}]\x1b[0m\r\n`);
      },
    });

    const inputSubscription = terminal.onData((data) => connection.sendInput(data));
    // Fires only when the grid actually changes, so fitting cannot loop.
    const resizeSubscription = terminal.onResize(({ cols, rows }) => {
      publish({ cols, rows });
      connection.resize(cols, rows);
    });

    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed) fit.fit();
      }, RESIZE_DEBOUNCE_MS);
    });

    // Measure character cells with the real font, not a fallback.
    void document.fonts.load(`${FONT_SIZE}px "JetBrains Mono"`).finally(() => {
      if (disposed) return;
      terminal.open(container);
      fit.fit();
      publish({ cols: terminal.cols, rows: terminal.rows });
      observer.observe(container);
      connection.start({ cols: terminal.cols, rows: terminal.rows }, agentId ? "attach" : "create");
    });

    return () => {
      disposed = true;
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      inputSubscription.dispose();
      resizeSubscription.dispose();
      connection.dispose();
      terminal.dispose();
    };
  }, [agentId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-w-0 min-h-0 overflow-hidden"
      data-testid="live-terminal"
      aria-label="Terminal"
    />
  );
}
