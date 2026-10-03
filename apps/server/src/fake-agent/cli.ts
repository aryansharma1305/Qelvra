// Development/test CLI, launched only by the fixed runtime resolver. No networking,
// router imports, registry mutation, other-inbox writes or shell command execution.
import { createInterface } from "node:readline";
import { realpath } from "node:fs/promises";
import { join } from "node:path";
import { AgentIdSchema } from "@qelvra/shared";
import { AgentRegistry } from "../agents/agent-registry.js";
import { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import { MailboxManager, MailboxError } from "../mailbox/index.js";
import { FakeInboxProcessor } from "./behavior.js";

async function main() {
  const agentId = AgentIdSchema.parse(process.env.QELVRA_AGENT_ID);
  const dataDir = process.env.QELVRA_DATA_DIR;
  if (!dataDir) throw new Error("Missing server configuration");
  const workspaces = await AgentWorkspaceManager.open(dataDir);
  if ((await realpath(process.cwd())) !== (await workspaces.getWorkspacePath(agentId)))
    throw new Error("Agent workspace mismatch");
  // Read fresh server-owned identity snapshots. This child never persists registry state.
  const mailbox = async () => {
    const registry = await AgentRegistry.open({ file: join(dataDir, "agents.json") });
    if (registry.require(agentId).providerId !== "fake") throw new Error("Demo agent unavailable");
    return new MailboxManager({ workspaces, registry });
  };
  await mailbox();
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  terminal.setPrompt("> ");
  let automatic = true;
  let closing = false;
  let tail = Promise.resolve();
  // Keep response identity until acknowledgement succeeds, avoiding duplicates on a
  // retry within this process. Crash-before-ack remains at-least-once, not exactly-once.
  const processor = new FakeInboxProcessor(agentId);
  const print = (text: string) => {
    process.stdout.write(`${text}\n`);
  };
  const report = (error: unknown) =>
    print(`ERROR ${error instanceof MailboxError ? error.code : "FAKE_OPERATION_FAILED"}`);
  const respond = async () => {
    const manager = await mailbox();
    const list = await manager.listMessages(agentId, "inbox");
    for (const entry of list.invalid) print(`INVALID_INBOX ${entry.reason}`);
    for (const message of list.messages) {
      if (closing) break;
      try {
        const response = await processor.process(manager, message);
        if (response) print(`RESPONDED ${message.id} ${response.id}`);
      } catch (error) {
        report(error);
      }
    }
  };
  const command = async (line: string) => {
    if (line.length > 65536) throw new Error("Command too long");
    const [verb, rest = ""] = /^([^\s]+)(?:\s+(.*))?$/.exec(line.trim())?.slice(1) ?? [""];
    switch (verb) {
      case "":
        break;
      case "PING":
        print("PONG");
        break;
      case "ECHO":
        print(rest);
        break;
      case "STATUS":
        print(`READY ${agentId}`);
        break;
      case "SEND":
      case "SEND_TASK": {
        const parsed = /^(\S+)\s+(.+)$/.exec(rest);
        if (!parsed?.[1] || !parsed[2]) {
          print("ERROR USAGE_SEND");
          break;
        }
        const message = await (
          await mailbox()
        ).writeOutboxMessage(agentId, {
          to: parsed[1],
          type: verb === "SEND_TASK" ? "task" : "message",
          body: parsed[2],
        });
        print(`MESSAGE_QUEUED ${message.id}`);
        break;
      }
      case "CHECK_INBOX": {
        const list = await (await mailbox()).listMessages(agentId, "inbox");
        print(`${list.messages.length} MESSAGE${list.messages.length === 1 ? "" : "S"}`);
        for (const message of list.messages)
          print(`${message.type} ${message.from} ${message.id}\n${JSON.stringify(message.body)}`);
        for (const entry of list.invalid) print(`INVALID_INBOX ${entry.reason}`);
        break;
      }
      case "RESPOND":
        await respond();
        break;
      case "AUTO_RESPOND":
        if (rest !== "ON" && rest !== "OFF") {
          print("ERROR USAGE_AUTO_RESPOND");
          break;
        }
        automatic = rest === "ON";
        print(`AUTO_RESPOND ${rest}`);
        if (automatic) await respond();
        break;
      default:
        print("ERROR UNKNOWN_COMMAND");
    }
  };
  const enqueue = (operation: () => Promise<void>) => {
    tail = tail
      .then(async () => {
        if (!closing) await operation();
      })
      .catch(report);
    return tail;
  };
  // Never overlap scans or queue missed ticks while a filesystem operation is running.
  let scanning = false;
  const timer = setInterval(() => {
    if (!automatic || closing || scanning) return;
    scanning = true;
    void enqueue(respond).finally(() => {
      scanning = false;
    });
  }, 500);
  const shutdown = () => {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    terminal.close();
    void tail.finally(() => process.exit(0));
  };
  for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"] as const) process.on(signal, shutdown);
  terminal.on("SIGINT", shutdown);
  terminal.on("close", shutdown);
  terminal.on("line", (line) => {
    void enqueue(() => command(line)).then(() => {
      if (!closing) terminal.prompt();
    });
  });
  print(`Qelvra Fake Agent\nAgent: ${agentId}\nREADY ${agentId}\nAUTO_RESPOND ON`);
  terminal.prompt();
  await enqueue(respond);
}

void main().catch(() => {
  process.stderr.write("FAKE_START_FAILED\n");
  process.exitCode = 1;
});
