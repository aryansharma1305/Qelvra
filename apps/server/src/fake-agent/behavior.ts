import type { Message, OutboxMessageInput } from "@qelvra/shared";
import type { MailboxManager } from "../mailbox/index.js";

/** Results/status/errors are terminal data, never another request. */
export function responseFor(message: Message): OutboxMessageInput | null {
  if (message.type !== "message" && message.type !== "task") return null;
  return {
    to: message.from,
    type: "result",
    body: `${message.type === "task" ? "DONE" : "ACK"}:${message.body}`,
  };
}

/** Response identity survives acknowledgement retries within one CLI process. */
export class FakeInboxProcessor {
  private readonly responses = new Map<string, Message>();
  constructor(private readonly agentId: string) {}

  async process(
    mailbox: Pick<MailboxManager, "writeOutboxMessage" | "acknowledgeMessage">,
    message: Message,
  ): Promise<Message | null> {
    const input = responseFor(message);
    if (!input) return null;
    let response = this.responses.get(message.id);
    if (!response) {
      response = await mailbox.writeOutboxMessage(this.agentId, input);
      this.responses.set(message.id, response);
    }
    await mailbox.acknowledgeMessage(this.agentId, "inbox", message.id, message);
    this.responses.delete(message.id);
    return response;
  }
}
