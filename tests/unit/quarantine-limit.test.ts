import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { AgentWorkspaceManager } from "../../apps/server/src/workspaces/agent-workspace-manager.js";
it("bounds generated quarantine metadata without deleting archived entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-quarantine-limit-"));
  try {
    const manager = await AgentWorkspaceManager.open(dir);
    const sender = join(manager.hiveRoot, "quarantine", "nova");
    await mkdir(sender, { recursive: true });
    await Promise.all(Array.from({ length: 1000 }, (_, i) => mkdir(join(sender, `entry-${i}`))));
    await expect(manager.createQuarantineDirectory("nova")).rejects.toThrow("quarantine");
    expect(await readdir(sender)).toHaveLength(1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
