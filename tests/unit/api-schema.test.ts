import { ApiErrorResponseSchema, HealthResponseSchema } from "@qelvra/shared";
import { describe, expect, it } from "vitest";

describe("API contracts", () => {
  it("accepts a valid health response", () => {
    const body = { status: "ok", version: "0.1.0", timestamp: "2026-10-03T10:00:00.000Z" };
    expect(HealthResponseSchema.parse(body)).toEqual(body);
  });

  it.each([
    { status: "degraded", version: "0.1.0", timestamp: "2026-10-03T10:00:00.000Z" },
    { status: "ok", version: "", timestamp: "2026-10-03T10:00:00.000Z" },
    { status: "ok", version: "0.1.0", timestamp: "yesterday" },
    { status: "ok", version: "0.1.0" },
  ])("rejects malformed health response %o", (body) => {
    expect(HealthResponseSchema.safeParse(body).success).toBe(false);
  });

  it("describes the error envelope", () => {
    expect(
      ApiErrorResponseSchema.safeParse({ error: { code: "NOT_FOUND", message: "x" } }).success,
    ).toBe(true);
    expect(ApiErrorResponseSchema.safeParse({ message: "x" }).success).toBe(false);
  });
});
