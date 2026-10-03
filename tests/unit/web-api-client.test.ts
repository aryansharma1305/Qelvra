import { describe, expect, it, vi } from "vitest";
import { ApiError, DEFAULT_API_URL, getHealth } from "../../apps/web/src/lib/api";

const ok = { status: "ok", version: "0.1.0", timestamp: "2026-10-03T10:00:00.000Z" };

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
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
  throw new Error("expected the request to fail");
}

describe("getHealth", () => {
  it("requests /api/health from the configured server and returns the parsed body", async () => {
    const fetchImpl = respond(ok);
    await expect(getHealth({ fetchImpl })).resolves.toEqual(ok);
    expect(fetchImpl).toHaveBeenCalledWith(`${DEFAULT_API_URL}/api/health`, expect.anything());
  });

  it("surfaces the server's error envelope", async () => {
    const error = await failure(
      getHealth({
        fetchImpl: respond({ error: { code: "INTERNAL_ERROR", message: "boom" } }, 500),
      }),
    );
    expect(error).toMatchObject({
      kind: "http",
      status: 500,
      code: "INTERNAL_ERROR",
      message: "boom",
    });
  });

  it("rejects responses that do not match the shared contract", async () => {
    const error = await failure(getHealth({ fetchImpl: respond({ status: "maybe" }) }));
    expect(error.kind).toBe("invalid_response");
  });

  it("rejects non-JSON responses", async () => {
    const error = await failure(getHealth({ fetchImpl: respond("<html>proxy error</html>", 502) }));
    expect(error.kind).toBe("invalid_response");
  });

  it("maps connection failures to a network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const error = await failure(getHealth({ fetchImpl }));
    expect(error.kind).toBe("network");
  });

  it("times out slow servers", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const error = await failure(getHealth({ fetchImpl, timeoutMs: 20 }));
    expect(error.kind).toBe("timeout");
  });

  it("lets caller cancellation propagate unchanged", async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    const pending = getHealth({ fetchImpl, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
