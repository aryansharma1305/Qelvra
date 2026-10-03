import type { Message } from "@qelvra/shared";
import type { MailboxErrorCode } from "./errors.js";
export type MailboxBox = "inbox" | "outbox";
export interface MailboxList {
  messages: Message[];
  invalid: { filename: string; reason: MailboxErrorCode | "NON_JSON_FILE" }[];
}
