import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsFixture } from "../fixtures/analytics-service";
import { getAnalytics } from "../../apps/web/src/lib/api";
import { ANALYTICS_RANGE } from "../fixtures/analytics-history";
const fixtures: Awaited<ReturnType<typeof analyticsFixture>>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
const response = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
describe("central Analytics client", () => {
  it("sends only narrow read-only filters and validates the real service response", async () => {
    const fixture = await analyticsFixture();
    fixtures.push(fixture);
    const result = await fixture.service.get(ANALYTICS_RANGE);
    const fetchImpl = response(result);
    expect(await getAnalytics({ ...ANALYTICS_RANGE, agentId: "nova" }, { fetchImpl })).toEqual(
      result,
    );
    const call = fetchImpl.mock.calls[0];
    expect(call).toEqual([
      expect.stringContaining("/api/analytics?from=2026-10-01&to=2026-10-05&agentId=nova"),
      expect.objectContaining({ method: "GET" }),
    ]);
    for (const body of [
      { ...result, rawEvents: [] },
      { ...result, summary: { ...result.summary, recordedEvents: -1 } },
      { ...result, unavailable: { ...result.unavailable, providerCost: 0 } },
    ])
      await expect(getAnalytics({}, { fetchImpl: response(body) })).rejects.toMatchObject({
        kind: "invalid_response",
      });
  });
  it("preserves controlled query failures instead of returning fake zero data", async () => {
    await expect(
      getAnalytics(
        {},
        {
          fetchImpl: response(
            { error: { code: "ANALYTICS_INVALID_QUERY", message: "Invalid range" } },
            400,
          ),
        },
      ),
    ).rejects.toMatchObject({ status: 400, code: "ANALYTICS_INVALID_QUERY" });
    await expect(
      getAnalytics(
        {},
        {
          fetchImpl: vi.fn(async () => {
            throw new Error("offline");
          }),
        },
      ),
    ).rejects.toMatchObject({ kind: "network" });
  });
});
