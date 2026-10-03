import { z } from "zod";
import { AgentIdSchema } from "./agent.js";

/** UTF-8 bytes, rather than characters. Bodies remain opaque, unmodified text. */
export const MESSAGE_BODY_MAX_BYTES = 64 * 1024;
export const MessageIdSchema = z
  .string()
  .regex(
    /^msg-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    "Message id must be msg- followed by a lowercase UUID v4",
  );
export const MessageTypeSchema = z.enum(["task", "message", "result", "status", "error"]);
const BodySchema = z
  .string()
  .min(1)
  .max(MESSAGE_BODY_MAX_BYTES)
  .refine(
    (body) =>
      !body.includes("\0") && new TextEncoder().encode(body).length <= MESSAGE_BODY_MAX_BYTES,
    "Body must contain no null bytes and be at most 64 KiB of UTF-8",
  );
export const OutboxMessageInputSchema = z.strictObject({
  to: AgentIdSchema,
  type: MessageTypeSchema,
  body: BodySchema,
});
export const MessageSchema = z.strictObject({
  id: MessageIdSchema,
  from: AgentIdSchema,
  to: AgentIdSchema,
  type: MessageTypeSchema,
  body: BodySchema,
  createdAt: z.iso.datetime(),
});
export type Message = z.infer<typeof MessageSchema>;
export type OutboxMessageInput = z.infer<typeof OutboxMessageInputSchema>;
