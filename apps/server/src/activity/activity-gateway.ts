import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { originGuard } from "../websocket/protocol.js";
import type { ActivityPublisher } from "./activity-publisher.js";
/** Registered after the shared WebSocket plugin. Read-only, separate from PTY protocol. */
export function registerActivityGateway(
  app: FastifyInstance,
  activity: ActivityPublisher,
  allowedOrigins: readonly string[],
) {
  const sockets = new Set<WebSocket>();
  app.get(
    "/ws/activity",
    { websocket: true, preValidation: originGuard(allowedOrigins) },
    (socket) => {
      sockets.add(socket);
      const send = (frame: unknown) => {
        if (socket.readyState !== socket.OPEN) return;
        if (socket.bufferedAmount > 256 * 1024) {
          socket.terminate();
          return;
        }
        socket.send(JSON.stringify(frame), (error) => {
          if (error) socket.terminate();
        });
      };
      const events = activity.subscribe((event) => send({ type: "activity.event", event }));
      const status = activity.subscribeStatus((status) =>
        send({ type: "activity.status", status }),
      );
      socket.on("message", () => socket.close(1008, "Activity stream is read-only"));
      socket.on("error", () => socket.terminate());
      socket.once("close", () => {
        events.dispose();
        status.dispose();
        sockets.delete(socket);
      });
      send({ type: "activity.status", status: activity.status() });
    },
  );
  // Termination makes shutdown bounded even for clients that ignore close handshakes.
  app.addHook("preClose", async () => {
    for (const socket of sockets) socket.terminate();
  });
}
