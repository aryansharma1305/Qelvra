import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../../../apps/server/src/agents/agent-registry";
import { AgentWorkspaceManager } from "../../../apps/server/src/workspaces/agent-workspace-manager";
import { MailboxManager } from "../../../apps/server/src/mailbox";

describe("real router server signal shutdown", () => {
  it.each(["SIGINT", "SIGTERM"] as const)(
    "%s closes watcher and preserves delivered or pending envelopes",
    async (signal) => {
      const dir = await mkdtemp(join(tmpdir(), "qelvra-router-signal-"));
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "tests/fixtures/server-with-router.ts"],
        {
          env: { ...process.env, QELVRA_ROUTER_TEST_DATA: dir },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const lines: string[] = [];
      const reader = createInterface({ input: child.stdout });
      reader.on("line", (line) => lines.push(line));
      const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += String(data).slice(0, 2000);
      });
      try {
        const first = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Router signal fixture timed out")),
            10000,
          );
          reader.once("line", (line) => {
            clearTimeout(timer);
            resolve(line);
          });
          child.once("exit", () => {
            clearTimeout(timer);
            reject(new Error(`Fixture exited before ready: ${stderr}`));
          });
        });
        const { ids } = JSON.parse(first) as { ids: string[] };
        expect(ids).toHaveLength(10);
        child.kill(signal);
        expect(await exited).toBe(0);
        expect(lines.map((line) => JSON.parse(line))).toContainEqual({
          routerStopped: true,
          inFlight: 0,
        });
        const registry = await AgentRegistry.open({ file: join(dir, "agents.json") });
        const workspaces = await AgentWorkspaceManager.open(dir);
        const mailbox = new MailboxManager({ registry, workspaces });
        const source = await mailbox.listMessages("nova", "outbox");
        const destination = await mailbox.listMessages("atlas", "inbox");
        expect(source.invalid).toEqual([]);
        expect(destination.invalid).toEqual([]);
        expect(
          new Set([...source.messages, ...destination.messages].map((message) => message.id)),
        ).toEqual(new Set(ids));
        for (const [owner, box] of [
          ["nova", "outbox"],
          ["atlas", "inbox"],
        ] as const) {
          expect(
            (await readdir(await workspaces.getMailboxPath(owner, box))).some((name) =>
              name.startsWith(".tmp-"),
            ),
          ).toBe(false);
        }
      } finally {
        reader.close();
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
          await exited;
        }
        await rm(dir, { recursive: true, force: true });
      }
    },
    15000,
  );
});
