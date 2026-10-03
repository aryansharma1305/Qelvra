import type { Message } from "@qelvra/shared";
/** Compare the entire V1 logical envelope, independent of JSON key/whitespace order. */
export function messagesEqual(a: Message, b: Message): boolean {
  return (
    a.id === b.id &&
    a.from === b.from &&
    a.to === b.to &&
    a.type === b.type &&
    a.body === b.body &&
    a.createdAt === b.createdAt
  );
}
