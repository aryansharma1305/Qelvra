import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

/** Only the configured web origins may call the API from a browser. */
export async function registerCors(
  app: FastifyInstance,
  allowedOrigins: readonly string[],
): Promise<void> {
  await app.register(cors, {
    origin: [...allowedOrigins],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
}
