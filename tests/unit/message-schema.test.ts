import { describe, expect, it } from "vitest";
import { MESSAGE_BODY_MAX_BYTES, MessageSchema } from "@qelvra/shared";
const valid = {
  id: "msg-12345678-1234-4123-8123-123456789abc",
  from: "nova",
  to: "atlas",
  type: "task",
  body: "hello",
  createdAt: "2026-10-03T00:00:00.000Z",
};
describe("MessageSchema", () => {
  it.each(["task", "message", "result", "status", "error"])("accepts %s", (type) => {
    expect(MessageSchema.parse({ ...valid, type }).type).toBe(type);
  });
  it.each([
    { type: "execute" },
    { from: "../nova" },
    { to: "a/b" },
    { from: "no\0va" },
    { to: "a\\b" },
    { body: "" },
    { body: "null\0byte" },
    { body: "a".repeat(MESSAGE_BODY_MAX_BYTES + 1) },
    { body: "🦊".repeat(MESSAGE_BODY_MAX_BYTES / 4 + 1) },
    { createdAt: "2026-02-30T00:00:00Z" },
    { createdAt: "yesterday" },
    { id: "../../secret" },
    { id: "msg-not-a-uuid" },
    { metadata: { arbitrary: true } },
  ])("rejects invalid fields %#", (fields) => {
    expect(MessageSchema.safeParse({ ...valid, ...fields }).success).toBe(false);
  });
  it("preserves opaque text and accepts exactly 64 KiB, including multibyte text", () => {
    for (const body of [
      "a".repeat(MESSAGE_BODY_MAX_BYTES),
      "🦊".repeat(MESSAGE_BODY_MAX_BYTES / 4),
      "  `rm -rf /`\n<script>  ",
    ]) {
      expect(MessageSchema.parse({ ...valid, body }).body).toBe(body);
    }
  });
});
