import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  DEFAULT_API_URL,
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  restartAgent,
  startAgent,
  stopAgent,
} from "../../apps/web/src/lib/api";

const nova = {
  id: "nova",
  name: "Nova",
  role: "Frontend",
  status: "stopped",
  providerId: null,
  createdAt: "2026-10-03T10:00:00.000Z",
  updatedAt: "2026-10-03T10:00:00.000Z",
};

function respond(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected failure");
}

describe("agent API client", () => {
  it("lists agents from a valid response", async () => {
    const fetchImpl = respond({ agents: [nova] });
    await expect(listAgents({ fetchImpl })).resolves.toEqual([nova]);
    expect(fetchImpl).toHaveBeenCalledWith(`${DEFAULT_API_URL}/api/agents`, expect.anything());
  });

  it.each([
    ["missing envelope", [nova]],
    ["unknown status", { agents: [{ ...nova, status: "hacking" }] }],
    ["unsafe id", { agents: [{ ...nova, id: "../etc" }] }],
    ["markup in name", { agents: [{ ...nova, name: "<img src=x>" }] }],
  ])("rejects a malformed list (%s)", async (_label, body) => {
    expect((await failure(listAgents({ fetchImpl: respond(body) }))).kind).toBe("invalid_response");
  });

  it("sends only name, role and id when creating", async () => {
    let request: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      request = init;
      return new Response(JSON.stringify({ agent: nova }), { status: 201 });
    });
    const sneaky = { name: "Nova", role: "Frontend", status: "working", command: "/bin/sh" };
    await expect(
      createAgent(sneaky as unknown as { name: string; role: string }, { fetchImpl }),
    ).resolves.toEqual(nova);
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({ name: "Nova", role: "Frontend" });
  });

  it("maps create errors to the server's code and message", async () => {
    const error = await failure(
      createAgent(
        { name: "Nova", role: "x" },
        {
          fetchImpl: respond(
            {
              error: {
                code: "AGENT_ALREADY_EXISTS",
                message: 'An agent with id "nova" already exists',
              },
            },
            409,
          ),
        },
      ),
    );
    expect(error).toMatchObject({ kind: "http", status: 409, code: "AGENT_ALREADY_EXISTS" });
    expect(error.message).toContain("already exists");
  });

  it("reports a missing agent as a 404 ApiError", async () => {
    const error = await failure(
      getAgent("ghost", {
        fetchImpl: respond({ error: { code: "AGENT_NOT_FOUND", message: "nope" } }, 404),
      }),
    );
    expect(error).toMatchObject({ status: 404, code: "AGENT_NOT_FOUND" });
  });

  it("encodes ids in the URL", async () => {
    const fetchImpl = respond({ agent: nova });
    await getAgent("nova", { fetchImpl });
    await failure(
      getAgent("../x", {
        fetchImpl: respond({ error: { code: "AGENT_INVALID_ID", message: "bad" } }, 400),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(`${DEFAULT_API_URL}/api/agents/nova`, expect.anything());
  });

  it("treats 204 as a successful delete", async () => {
    let method: string | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      method = init?.method;
      return new Response(null, { status: 204 });
    });
    await expect(deleteAgent("nova", { fetchImpl })).resolves.toBeUndefined();
    expect(method).toBe("DELETE");
  });

  it.each([
    ["start", startAgent],
    ["stop", stopAgent],
    ["restart", restartAgent],
  ] as const)("%s posts to the lifecycle endpoint without a body", async (action, call) => {
    let request: RequestInit | undefined;
    let url = "";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input);
      request = init;
      return new Response(JSON.stringify({ agent: { ...nova, status: "running" } }));
    });
    await expect(call("nova", { fetchImpl })).resolves.toMatchObject({ status: "running" });
    expect(url).toBe(`${DEFAULT_API_URL}/api/agents/nova/${action}`);
    expect(request?.method).toBe("POST");
    expect(request?.body).toBeUndefined();
  });

  it("maps lifecycle errors and rejects malformed agents", async () => {
    const conflict = await failure(
      startAgent("nova", {
        fetchImpl: respond(
          { error: { code: "AGENT_ALREADY_RUNNING", message: "already running" } },
          409,
        ),
      }),
    );
    expect(conflict).toMatchObject({ status: 409, code: "AGENT_ALREADY_RUNNING" });
    const malformed = await failure(
      stopAgent("nova", { fetchImpl: respond({ agent: { ...nova, status: "paused" } }) }),
    );
    expect(malformed.kind).toBe("invalid_response");
  });
});
