import { describe, expect, it, vi } from "vitest";
import { getAgentMemory, updateAgentMemory } from "../../apps/web/src/lib/api";
const memory = {
  agentId: "nova",
  content: "# Notes",
  size: 7,
  modifiedAt: "2026-10-08T00:00:00.000Z",
  revision: "a".repeat(64),
};
const response = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
describe("central memory API client", () => {
  it("validates fixed-agent responses and sends no path fields", async () => {
    const fetchImpl = response({ memory });
    expect(await getAgentMemory("nova", { fetchImpl })).toEqual(memory);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/api/agents/nova/memory"),
      expect.anything(),
    );
    await updateAgentMemory("nova", "notes", memory.revision, { fetchImpl });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "notes", expectedRevision: memory.revision }),
      }),
    );
    for (const invalid of [
      { ...memory, revision: "invalid" },
      { ...memory, path: "/secret" },
      { ...memory, size: 999999 },
    ])
      await expect(
        getAgentMemory("nova", { fetchImpl: response({ memory: invalid }) }),
      ).rejects.toMatchObject({ kind: "invalid_response" });
  });
  it("retains controlled conflict/corruption failures", async () => {
    await expect(
      updateAgentMemory("nova", "notes", memory.revision, {
        fetchImpl: response({ error: { code: "MEMORY_CHANGED_ON_DISK", message: "Reload" } }, 409),
      }),
    ).rejects.toMatchObject({ status: 409, code: "MEMORY_CHANGED_ON_DISK" });
    await expect(
      getAgentMemory("nova", {
        fetchImpl: response(
          { error: { code: "MEMORY_INVALID_UTF8", message: "Corrupt memory" } },
          415,
        ),
      }),
    ).rejects.toMatchObject({ code: "MEMORY_INVALID_UTF8" });
  });
});
