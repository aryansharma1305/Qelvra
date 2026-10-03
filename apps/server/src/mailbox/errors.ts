export type MailboxErrorCode =
  | "MAILBOX_AGENT_NOT_FOUND"
  | "MAILBOX_MESSAGE_NOT_FOUND"
  | "MAILBOX_INVALID_MESSAGE"
  | "MAILBOX_INVALID_BOX"
  | "MAILBOX_WRITE_FAILED"
  | "MAILBOX_READ_FAILED"
  | "MAILBOX_MESSAGE_TOO_LARGE"
  | "MAILBOX_DUPLICATE_MESSAGE"
  | "MAILBOX_INVALID_RECIPIENT"
  | "MAILBOX_UNSAFE_ENTRY"
  | "MAILBOX_DESTINATION_CONFLICT";

/** Transport-independent failures; never put filesystem paths in the message. */
export class MailboxError extends Error {
  override name = "MailboxError";
  constructor(
    readonly code: MailboxErrorCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
  }
}
