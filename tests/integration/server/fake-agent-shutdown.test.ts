import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { AgentRegistry } from "../../../apps/server/src/agents/agent-registry";
import { AgentWorkspaceManager } from "../../../apps/server/src/workspaces/agent-workspace-manager";
import { MailboxManager } from "../../../apps/server/src/mailbox";

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
it.each(["SIGINT", "SIGTERM"] as const)(
  "%s shuts down real server and every fake PTY process",
  async (signal) => {
    const dir = await mkdtemp(join(tmpdir(), "qelvra-fake-signal-"));
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/server-with-fake-agents.ts"],
      { env: { ...process.env, QELVRA_FAKE_TEST_DATA: dir }, stdio: ["ignore", "pipe", "pipe"] },
    );
    const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
    const reader = createInterface({ input: child.stdout });
    const pids: number[] = [];
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += String(data).slice(0, 2000);
    });
    try {
      const ready = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Fake signal fixture timed out")), 10000);
        reader.once("line", (line) => {
          clearTimeout(timer);
          resolve(line);
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error(`Fixture exited: ${stderr}`));
        });
      });
      pids.push(...(JSON.parse(ready) as { pids: number[] }).pids);
      expect(pids).toHaveLength(2);
      child.kill(signal);
      expect(await exited).toBe(0);
      for (const pid of pids) await expect.poll(() => alive(pid), { timeout: 5000 }).toBe(false);
      const registry = await AgentRegistry.open({ file: join(dir, "agents.json") });
      expect(registry.list().every((agent) => agent.status === "stopped")).toBe(true);
      const workspaces = await AgentWorkspaceManager.open(dir);
      const mailbox = new MailboxManager({ registry, workspaces });
      const pending = await mailbox.listMessages("atlas", "inbox");
      expect(pending.invalid).toEqual([]);
      expect(pending.messages).toEqual([
        expect.objectContaining({ from: "nova", to: "atlas", body: "SIGNAL_PENDING" }),
      ]);
    } finally {
      reader.close();
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
      for (const pid of pids) if (alive(pid)) process.kill(pid, "SIGKILL");
      await rm(dir, { recursive: true, force: true });
    }
  },
  15000,
);
