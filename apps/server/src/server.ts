import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";
import { isLoopbackHost, type ServerConfig } from "./config/env.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

export async function startServer(config: ServerConfig): Promise<FastifyInstance> {
  const app = await createApp(config);
  if (!isLoopbackHost(config.host)) {
    app.log.warn(
      { host: config.host },
      "Binding to a non-loopback address exposes the API to the network; it has no authentication yet",
    );
  }
  await app.listen({ host: config.host, port: config.port });
  return app;
}

/**
 * On SIGINT (Ctrl-C), SIGTERM, or SIGHUP (the controlling terminal was closed), closes the
 * app (which terminates all PTY sessions via its onClose hook) and exits; forces exit if
 * shutdown hangs. Without the SIGHUP handler, closing the window running the server would
 * kill it without cleaning up its shells.
 */
export function installShutdownHandlers(
  app: FastifyInstance,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
): void {
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "Shutting down");

    const forceExit = setTimeout(() => {
      app.log.error({ timeoutMs }, "Graceful shutdown timed out");
      process.exit(1);
    }, timeoutMs);
    forceExit.unref();

    app.close().then(
      () => {
        app.log.info("Server closed");
        process.exit(0);
      },
      (error: unknown) => {
        app.log.error({ err: error }, "Error during shutdown");
        process.exit(1);
      },
    );
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, shutdown);
}
