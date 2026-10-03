import { describe, expect, it, vi } from "vitest";
import { CreateAgentRequestSchema, type Message } from "@qelvra/shared";
import { FakeInboxProcessor, responseFor } from "../../apps/server/src/fake-agent/behavior";

describe("fake-agent deterministic behavior", () => {
  const message: Message = {
    id: "msg-00000000-0000-4000-8000-000000000000",
    from: "nova",
    to: "atlas",
    type: "message",
    body: "HELLO",
    createdAt: "2026-10-04T00:00:00Z",
  };
  it("responds to a message with an unchanged opaque body prefixed ACK", () => {
    expect(responseFor(message)).toEqual({ to: "nova", type: "result", body: "ACK:HELLO" });
    expect(responseFor({ ...message, body: "ECHO ; $(command)\nこんにちは" })?.body).toBe(
      "ACK:ECHO ; $(command)\nこんにちは",
    );
  });
  it("responds to a task with DONE", () => {
    expect(responseFor({ ...message, type: "task", body: "TASK:abc" })).toEqual({
      to: "nova",
      type: "result",
      body: "DONE:TASK:abc",
    });
  });
  it("reuses a successfully published response when source acknowledgement fails", async () => {
    const response: Message = {
      ...message,
      from: "atlas",
      to: "nova",
      type: "result",
      body: "ACK:HELLO",
    };
    const mailbox = {
      writeOutboxMessage: vi.fn().mockResolvedValue(response),
      acknowledgeMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockResolvedValue(true),
    };
    const processor = new FakeInboxProcessor("atlas");
    await expect(processor.process(mailbox, message)).rejects.toThrow("temporary failure");
    expect(await processor.process(mailbox, message)).toEqual(response);
    expect(mailbox.writeOutboxMessage).toHaveBeenCalledTimes(1);
    expect(mailbox.acknowledgeMessage).toHaveBeenLastCalledWith(
      "atlas",
      "inbox",
      message.id,
      message,
    );
  });
  it("does not acknowledge an incoming message when response creation fails", async () => {
    const mailbox = {
      writeOutboxMessage: vi.fn().mockRejectedValue(new Error("disk unavailable")),
      acknowledgeMessage: vi.fn(),
    };
    await expect(new FakeInboxProcessor("atlas").process(mailbox, message)).rejects.toThrow(
      "disk unavailable",
    );
    expect(mailbox.acknowledgeMessage).not.toHaveBeenCalled();
  });
  it.each(["result", "status", "error"] as const)("never responds to %s", (type) => {
    expect(responseFor({ ...message, type })).toBeNull();
  });
  it("accepts only fixed fake selection and strips executable configuration", () => {
    expect(
      CreateAgentRequestSchema.parse({
        name: "Nova",
        role: "Test",
        providerId: "fake",
        command: "evil",
        args: ["evil"],
        env: { QELVRA_AGENT_ID: "atlas" },
        cwd: "/tmp",
      }),
    ).toEqual({ name: "Nova", role: "Test", providerId: "fake" });
    expect(
      CreateAgentRequestSchema.safeParse({ name: "Nova", role: "Test", providerId: "/bin/sh" })
        .success,
    ).toBe(false);
  });
});
