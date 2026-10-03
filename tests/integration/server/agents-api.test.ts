import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentListResponseSchema,
  AgentResponseSchema,
  ApiErrorResponseSchema,
} from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "qelvra-api-"));
  app = await createApp(loadConfig({ DATA_DIR: dataDir }), { logger: false });
});

afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

function post(payload: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/agents",
    headers: { "content-type": "application/json", ...headers },
    payload: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function errorOf(res: { json(): unknown }) {
  return ApiErrorResponseSchema.parse(res.json()).error;
}

describe("agents API", () => {
  it("starts with an empty list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    expect(res.statusCode).toBe(200);
    expect(AgentListResponseSchema.parse(res.json())).toEqual({ agents: [] });
  });

  it("creates, lists, fetches and deletes an agent", async () => {
    const created = await post({ name: "Frontend Nova", role: "Frontend Engineer" });
    expect(created.statusCode).toBe(201);
    const { agent } = AgentResponseSchema.parse(created.json());
    expect(agent).toMatchObject({ id: "frontend-nova", status: "stopped", providerId: null });

    const list = AgentListResponseSchema.parse(
      (await app.inject({ method: "GET", url: "/api/agents" })).json(),
    );
    expect(list.agents.map((a) => a.id)).toEqual(["frontend-nova"]);

    const one = await app.inject({ method: "GET", url: "/api/agents/frontend-nova" });
    expect(one.statusCode).toBe(200);
    expect(AgentResponseSchema.parse(one.json()).agent).toEqual(agent);

    const deleted = await app.inject({ method: "DELETE", url: "/api/agents/frontend-nova" });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    expect((await app.inject({ method: "GET", url: "/api/agents/frontend-nova" })).statusCode).toBe(
      404,
    );
  });

  it("lists agents in creation order", async () => {
    for (const name of ["Zed", "Alpha", "Mid"]) await post({ name, role: "r" });
    const { agents } = AgentListResponseSchema.parse(
      (await app.inject({ method: "GET", url: "/api/agents" })).json(),
    );
    expect(agents.map((a) => a.id)).toEqual(["zed", "alpha", "mid"]);
  });

  it("never lets the client set status, command, cwd or env", async () => {
    const res = await post({
      name: "Atlas",
      role: "Backend",
      status: "working",
      command: "/bin/rm",
      args: ["-rf", "/"],
      cwd: "/",
      env: { SECRET: "x" },
    });
    expect(res.statusCode).toBe(201);
    expect(AgentResponseSchema.parse(res.json()).agent).toMatchObject({
      status: "stopped",
      providerId: null,
    });
    expect(res.body).not.toMatch(/bin\/rm|SECRET/);
  });

  it("rejects executable-looking provider IDs", async () => {
    const res = await post({ name: "Unsafe", role: "Test", providerId: "/bin/sh" });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res).code).toBe("AGENT_INVALID_PROVIDER");
  });

  it("rejects duplicates with 409", async () => {
    await post({ name: "Nova", role: "r" });
    const res = await post({ name: "Nova", role: "other" });
    expect(res.statusCode).toBe(409);
    expect(errorOf(res).code).toBe("AGENT_ALREADY_EXISTS");
  });

  it.each([
    [{ name: "", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "<script>alert(1)</script>", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "Nova", role: "" }, "AGENT_INVALID_ROLE"],
    [{ name: "Nova", role: "r", id: "../../etc" }, "AGENT_INVALID_ID"],
    [{ role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: 42, role: "r" }, "AGENT_INVALID_NAME"],
  ])("rejects %o with 400 %s", async (body, code) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    expect(errorOf(res).code).toBe(code);
  });

  it.each([
    ["malformed JSON", "{not json", "BAD_REQUEST"],
    ["an array", "[1,2]", "VALIDATION_ERROR"],
    ["a string", '"nova"', "VALIDATION_ERROR"],
  ])("rejects %s as a client error", async (_label, raw, code) => {
    const res = await post(raw);
    expect(res.statusCode).toBe(400);
    expect(errorOf(res).code).toBe(code);
  });

  it("returns 404 for unknown agents and 400 for unsafe ids", async () => {
    const missing = await app.inject({ method: "GET", url: "/api/agents/ghost" });
    expect(missing.statusCode).toBe(404);
    expect(errorOf(missing).code).toBe("AGENT_NOT_FOUND");

    const deleteMissing = await app.inject({ method: "DELETE", url: "/api/agents/ghost" });
    expect(deleteMissing.statusCode).toBe(404);

    for (const url of ["/api/agents/..%2F..%2Fetc", "/api/agents/UPPER", "/api/agents/%00"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(400);
      expect(errorOf(res).code).toBe("AGENT_INVALID_ID");
    }
  });

  it("persists across app restarts", async () => {
    await post({ name: "Nova", role: "Frontend" });
    await app.close();
    app = await createApp(loadConfig({ DATA_DIR: dataDir }), { logger: false });
    const { agents } = AgentListResponseSchema.parse(
      (await app.inject({ method: "GET", url: "/api/agents" })).json(),
    );
    expect(agents.map((a) => a.id)).toEqual(["nova"]);
  });

  it("allows CORS for the web origin on writes", async () => {
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/agents/nova",
      headers: { origin: "http://127.0.0.1:5173", "access-control-request-method": "DELETE" },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-methods"]).toContain("DELETE");
  });
});
