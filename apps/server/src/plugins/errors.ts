import { API_ERROR_CODES, type ApiErrorResponse } from "@qelvra/shared";
import type { FastifyError, FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";

function body(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

/**
 * Every error leaves the API as `{ error: { code, message } }`. Messages of unexpected
 * (5xx) errors are replaced with a generic one; details only go to the server log.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    void reply
      .code(404)
      .send(body(API_ERROR_CODES.NOT_FOUND, `Route ${request.method} ${request.url} not found`));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      void reply.code(error.statusCode).send(body(error.code, error.message));
      return;
    }

    if (error.validation) {
      void reply.code(400).send(body(API_ERROR_CODES.VALIDATION_ERROR, error.message));
      return;
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      // Client errors raised by Fastify itself (malformed JSON, payload too large, ...).
      void reply.code(statusCode).send(body(API_ERROR_CODES.BAD_REQUEST, error.message));
      return;
    }

    request.log.error({ err: error }, "Unhandled error while processing request");
    void reply.code(500).send(body(API_ERROR_CODES.INTERNAL_ERROR, "Internal server error"));
  });
}
