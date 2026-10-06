import type { FastifyInstance } from "fastify";
import { isLoopbackHost, type ServerConfig } from "../config/env.js";

/** CORS response headers alone do not prevent cross-origin browser mutations. */
export function registerLocalSecurity(app: FastifyInstance, config: ServerConfig) {
  const origins = new Set(config.webOrigins);
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Cache-Control", "no-store");
  });
  app.addHook("preValidation", async (request, reply) => {
    const origin = request.headers.origin;
    if (
      (origin !== undefined && !origins.has(origin)) ||
      (!origin && request.headers["sec-fetch-site"] === "cross-site")
    )
      return reply.code(403).send({
        error: {
          code: "BAD_REQUEST",
          message: "This browser origin is not allowed. Open the configured local Qelvra URL.",
        },
      });
    if (isLoopbackHost(config.host)) {
      let hostname = "";
      try {
        hostname = new URL(`http://${request.headers.host ?? ""}`).hostname;
      } catch {
        /* reject malformed Host */
      }
      if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname))
        return reply.code(403).send({
          error: {
            code: "BAD_REQUEST",
            message: "Use a loopback hostname for the local Qelvra server.",
          },
        });
    }
  });
}
