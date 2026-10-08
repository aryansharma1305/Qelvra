import { describe, expect, it, vi } from "vitest";
import { getSettings, refreshProviders } from "../../apps/web/src/lib/api";
import { settingsFixture } from "../fixtures/settings";

const response = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
describe("central Settings clients", () => {
  it("validates runtime data and sends a narrow POST with no process/configuration options", async () => {
    const fixture = await settingsFixture();
    const read = response(fixture.settings);
    expect(await getSettings({ fetchImpl: read })).toEqual(fixture.settings);
    expect(read.mock.calls[0]).toEqual([
      expect.stringContaining("/api/settings"),
      expect.objectContaining({ method: "GET" }),
    ]);
    const refresh = response({ providers: fixture.providers });
    expect(await refreshProviders({ fetchImpl: refresh })).toEqual(fixture.providers);
    expect(refresh.mock.calls[0]).toEqual([
      expect.stringContaining("/api/providers/refresh"),
      expect.objectContaining({ method: "POST", body: "{}" }),
    ]);
    await expect(
      getSettings({ fetchImpl: response({ ...fixture.settings, rawEnvironment: {} }) }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
    await expect(
      refreshProviders({
        fetchImpl: response({ providers: [{ ...fixture.providers[0], executable: "/private" }] }),
      }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });
  it("preserves failures without manufacturing settings or provider values", async () => {
    await expect(
      refreshProviders({
        fetchImpl: response(
          { error: { code: "PROVIDER_DETECTION_FAILED", message: "Retry discovery" } },
          503,
        ),
      }),
    ).rejects.toMatchObject({ status: 503, code: "PROVIDER_DETECTION_FAILED" });
    await expect(
      getSettings({
        fetchImpl: vi.fn(async () => {
          throw new Error("offline");
        }),
      }),
    ).rejects.toMatchObject({ kind: "network" });
  });
});
