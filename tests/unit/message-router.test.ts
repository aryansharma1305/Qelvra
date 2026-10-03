import { describe, expect, it } from "vitest";
import { isMessageCandidate, isPermanentDeliveryError } from "../../apps/server/src/router";
import { messagesEqual } from "../../apps/server/src/mailbox/message-integrity";
import type { Message } from "@qelvra/shared";
const message: Message = {
  id: "msg-12345678-1234-4123-8123-123456789abc",
  from: "nova",
  to: "atlas",
  type: "message",
  body: "opaque text",
  createdAt: "2026-10-03T00:00:00.000Z",
};
describe("router policy", () => {
  it.each([
    "MAILBOX_INVALID_MESSAGE",
    "MAILBOX_MESSAGE_TOO_LARGE",
    "MAILBOX_INVALID_RECIPIENT",
    "MAILBOX_DESTINATION_CONFLICT",
    "MAILBOX_UNSAFE_ENTRY",
  ] as const)("classifies %s as permanent", (code) =>
    expect(isPermanentDeliveryError(code)).toBe(true),
  );
  it.each(["MAILBOX_WRITE_FAILED", "MAILBOX_READ_FAILED", "MAILBOX_AGENT_NOT_FOUND"] as const)(
    "classifies %s as transient",
    (code) => expect(isPermanentDeliveryError(code)).toBe(false),
  );
  it.each([".tmp-message.json", ".hidden.json", "message.json.swp", "notes.md"])(
    "ignores %s",
    (name) => expect(isMessageCandidate(name)).toBe(false),
  );
  it("accepts regular JSON candidates, even malformed ids for quarantine", () =>
    expect(isMessageCandidate("invalid-id.json")).toBe(true));
  it("compares all six fields of a logical message", () => {
    expect(messagesEqual(message, { ...message })).toBe(true);
    for (const changed of [
      { id: message.id + "a" },
      { from: "scout" },
      { to: "scout" },
      { type: "task" as const },
      { body: "different" },
      { createdAt: "2026-10-04T00:00:00.000Z" },
    ]) {
      expect(messagesEqual(message, { ...message, ...changed })).toBe(false);
    }
  });
});
