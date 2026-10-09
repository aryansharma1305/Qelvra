import { describe, expect, it, vi } from "vitest";
import { getNetwork } from "../../apps/web/src/lib/api";
import { networkFixture } from "../fixtures/network";
const response = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
describe("Network client", () => {
  it("uses a validated GET and rejects extra response fields", async () => {
    const fixture = networkFixture(),
      fetchImpl = response(fixture);
    expect(await getNetwork({}, { fetchImpl })).toEqual(fixture);
    expect(fetchImpl.mock.calls[0]).toEqual([
      expect.stringContaining("/api/network?window=24h"),
      expect.objectContaining({ method: "GET" }),
    ]);
    await expect(
      getNetwork({}, { fetchImpl: response({ ...fixture, body: "PRIVATE" }) }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });
  it("propagates transport failures without manufacturing a graph", async () => {
    await expect(
      getNetwork(
        {},
        {
          fetchImpl: vi.fn(async () => {
            throw new Error("offline");
          }),
        },
      ),
    ).rejects.toMatchObject({ kind: "network" });
    await expect(
      getNetwork(
        {},
        {
          fetchImpl: response(
            { error: { code: "VALIDATION_ERROR", message: "Invalid query" } },
            400,
          ),
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
