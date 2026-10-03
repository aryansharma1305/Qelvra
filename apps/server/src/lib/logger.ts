/** Subset of pino/Fastify's logger used by services that must not depend on Fastify. */
export interface ServiceLogger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export const silentLogger: ServiceLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
