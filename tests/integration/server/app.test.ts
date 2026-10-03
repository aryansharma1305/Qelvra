import { ApiErrorResponseSchema, HealthResponseSchema } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";

/** Never touch a real registry file from tests. */
const TEST_DATA_DIR = mkdtempSync(joinPath(tmpdir(), "qelvra-test-data-"));
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { AppError } from "../../../apps/server/src/lib/errors";
import {
  cleanupManagers,
  createTestManager,
  isAlive,
  requirePid,
  waitForExit,
} from "../pty/helpers";

const WEB_ORIGIN = "http://127.0.0.1:5173";
let app: FastifyInstance;

beforeEach(async () => {
  app = await createApp(loadConfig({ WEB_ORIGIN, DATA_DIR: TEST_DATA_DIR }), { logger: false });
});

afterEach(async () => {
  await app.close();
});

afterAll(() => rmSync(TEST_DATA_DIR, { recursive: true, force: true }));

describe("GET /api/health", () => {
  it("reports ok with version and a current ISO timestamp", async () => {
    const before = Date.now();
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    const body = HealthResponseSchema.parse(res.json());
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    const time = Date.parse(body.timestamp);
    expect(time).toBeGreaterThanOrEqual(before - 1000);
    expect(time).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe("CORS", () => {
  it("allows the configured web origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: { origin: WEB_ORIGIN },
    });
    expect(res.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
  });

  it("answers preflight requests from the configured origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/health",
      headers: { origin: WEB_ORIGIN, "access-control-request-method": "GET" },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
  });

  it("does not grant access to other origins", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: { origin: "http://evil.example" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("error handling", () => {
  it("returns a structured 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorResponseSchema.parse(res.json())).toEqual({
      error: { code: "NOT_FOUND", message: "Route GET /api/does-not-exist not found" },
    });
  });

  it("hides internal error details", async () => {
    app.get("/boom", async () => {
      throw new Error("database password is hunter2");
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
    expect(res.body).not.toContain("hunter2");
    expect(res.body).not.toContain("stack");
  });

  it("passes through AppError codes and messages", async () => {
    app.get("/teapot", async () => {
      throw new AppError(400, "BAD_REQUEST", "Agent id is invalid");
    });
    const res = await app.inject({ method: "GET", url: "/teapot" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: "BAD_REQUEST", message: "Agent id is invalid" } });
  });

  it("reports malformed JSON bodies as client errors", async () => {
    app.post("/echo", async (request) => request.body);
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(ApiErrorResponseSchema.parse(res.json()).error.code).toBe("BAD_REQUEST");
  });
});

describe("shutdown", () => {
  afterEach(cleanupManagers);

  it("terminates every PTY session when the app closes", async () => {
    const pty = createTestManager();
    const closingApp = await createApp(loadConfig({ WEB_ORIGIN, DATA_DIR: TEST_DATA_DIR }), {
      logger: false,
      ptyManager: pty,
    });
    expect(closingApp.pty).toBe(pty);
    const sessions = [pty.createSession({ id: "s1" }), pty.createSession({ id: "s2" })];
    const exits = sessions.map((s) => waitForExit(pty, s.id));

    await closingApp.close();

    await Promise.all(exits);
    expect(pty.size).toBe(0);
    for (const session of sessions) expect(isAlive(requirePid(session))).toBe(false);
  });
});
