import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
let app: FastifyInstance | undefined;
let dir: string;
afterEach(async () => {
  await app?.close();
  await rm(dir, { recursive: true, force: true });
});
async function setup() {
  dir = await mkdtemp(join(tmpdir(), "qelvra-mailbox-integration-"));
  const config = loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir });
  app = await createApp(config, { logger: false });
  for (const id of ["nova", "atlas"]) {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/agents",
          payload: { id, name: id, role: "Test" },
        })
      ).statusCode,
    ).toBe(201);
  }
  return { server: app, config };
}
describe("internal mailbox composition", () => {
  it("persists HELLO_ATLAS across server restart, with no delivery or runtime", async () => {
    const { server, config } = await setup();
    const message = await server.mailbox.writeOutboxMessage("nova", {
      to: "atlas",
      type: "message",
      body: "HELLO_ATLAS",
    });
    const novaOutbox = join(dir, "hive", "agents", "nova", "outbox");
    expect(JSON.parse(await readFile(join(novaOutbox, `${message.id}.json`), "utf8"))).toEqual(
      message,
    );
    expect(await readdir(join(dir, "hive", "agents", "atlas", "inbox"))).toEqual([]);
    expect(server.pty.size).toBe(0);
    expect(server.runtime.size).toBe(0);
    await server.close();
    app = await createApp(config, { logger: false });
    expect(await app.mailbox.readMessage("nova", "outbox", message.id)).toEqual(message);
    expect((await app.mailbox.listMessages("atlas", "inbox")).messages).toEqual([]);
    expect(await app.mailbox.acknowledgeMessage("nova", "outbox", message.id)).toBe(true);
    expect(await readdir(novaOutbox)).toEqual([]);
    expect(app.pty.size).toBe(0);
    expect(app.runtime.size).toBe(0);
  });
  it("does not expose messaging routes and rejects deleted recipients despite preserved workspaces", async () => {
    const { server } = await setup();
    await server.runtime.delete("atlas");
    expect(await server.workspaces.exists("atlas")).toBe(true);
    await expect(
      server.mailbox.writeOutboxMessage("nova", { to: "atlas", type: "task", body: "work" }),
    ).rejects.toMatchObject({ code: "MAILBOX_INVALID_RECIPIENT" });
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/agents/nova/messages",
          payload: { to: "atlas", body: "hello" },
        })
      ).statusCode,
    ).toBe(404);
    expect((await server.inject({ method: "GET", url: "/api/agents/nova/inbox" })).statusCode).toBe(
      404,
    );
  });
});
