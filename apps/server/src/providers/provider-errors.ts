export const PROVIDER_ERROR_CODES = [
  "PROVIDER_NOT_FOUND",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_EXECUTABLE_NOT_FOUND",
  "PROVIDER_DETECTION_FAILED",
  "PROVIDER_AUTH_REQUIRED",
  "PROVIDER_CONFIGURATION_REQUIRED",
  "PROVIDER_LAUNCH_FAILED",
] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];
/** Messages are fixed by server code; never include command output or spawn internals. */
export class ProviderError extends Error {
  override name = "ProviderError";
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
  }
}
