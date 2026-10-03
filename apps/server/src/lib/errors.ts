import type { ApiErrorCode } from "@qelvra/shared";

/** An error whose code and message are safe to return to API clients. */
export class AppError extends Error {
  override name = "AppError";

  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}
