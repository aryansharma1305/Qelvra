import type { FastifyInstance } from "fastify";
import type { NetworkService } from "./network-service.js";
export function registerNetworkRoutes(app: FastifyInstance, service: NetworkService) {
  app.get("/api/network", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return service.get(request.query);
  });
}
