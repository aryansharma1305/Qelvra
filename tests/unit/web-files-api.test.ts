import { describe, expect, it, vi } from "vitest";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceDirectory,
  moveWorkspaceEntry,
  deleteWorkspaceEntry,
} from "../../apps/web/src/lib/api";
const entry = {
  name: "a.txt",
  path: "src/a.txt",
  type: "file",
  size: 1,
  modifiedAt: "2026-10-08T00:00:00.000Z",
};
const file = {
  path: entry.path,
  size: 1,
  modifiedAt: entry.modifiedAt,
  content: "x",
  encoding: "utf-8",
  revision: "a".repeat(64),
};
const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }));
describe("Files centralized API client", () => {
  it("encodes agent identity/relative paths and validates listing/content contracts", async () => {
    const fetchImpl = respond({ path: "src", parentPath: "", entries: [entry], hiddenEntries: 0 });
    await expect(listWorkspaceFiles("nova", "src", { fetchImpl })).resolves.toMatchObject({
      entries: [entry],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/api/agents/nova/files?path=src"),
      expect.anything(),
    );
    await expect(
      readWorkspaceFile("nova", entry.path, { fetchImpl: respond({ file }) }),
    ).resolves.toEqual(file);
    for (const invalid of [
      { ...file, path: "/etc/passwd" },
      { ...file, encoding: "binary" },
      { ...file, revision: "not-a-revision" },
    ])
      await expect(
        readWorkspaceFile("nova", entry.path, { fetchImpl: respond({ file: invalid }) }),
      ).rejects.toMatchObject({ kind: "invalid_response" });
    await expect(
      listWorkspaceFiles("nova", "", {
        fetchImpl: respond({
          path: "",
          parentPath: null,
          entries: [{ ...entry, path: "../atlas" }],
          hiddenEntries: 0,
        }),
      }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });
  it("uses explicit mutation methods and retains conflict errors", async () => {
    const fetchImpl = respond({ file });
    const input = { path: file.path, content: "edit", revision: file.revision };
    await writeWorkspaceFile("nova", input, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/files/content"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify(input) }),
    );
    for (const call of [createWorkspaceFile, createWorkspaceDirectory])
      await expect(
        call("nova", entry.path, { fetchImpl: respond({ entry }, 201) }),
      ).resolves.toEqual(entry);
    await expect(
      moveWorkspaceEntry("nova", "old.txt", entry.path, { fetchImpl: respond({ entry }) }),
    ).resolves.toEqual(entry);
    const deletion = respond(null, 204);
    await deleteWorkspaceEntry("nova", entry.path, false, { fetchImpl: deletion });
    expect(deletion).toHaveBeenCalledWith(
      expect.stringContaining("/files"),
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ path: entry.path, recursive: false }),
      }),
    );
    await expect(
      writeWorkspaceFile("nova", input, {
        fetchImpl: respond(
          { error: { code: "FILE_CHANGED_ON_DISK", message: "Reload before saving" } },
          409,
        ),
      }),
    ).rejects.toMatchObject({ status: 409, code: "FILE_CHANGED_ON_DISK" });
  });
});
