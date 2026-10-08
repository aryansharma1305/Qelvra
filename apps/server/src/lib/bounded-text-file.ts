import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { access, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ApiErrorCode } from "@qelvra/shared";
import { AppError } from "./errors.js";

export interface TextFilePolicy {
  limit: number;
  readBinaryMessage: string;
  resolve: () => Promise<{ path: string; info: Stats | null }>;
  validateParent: () => Promise<unknown>;
  codes: {
    large: ApiErrorCode;
    binary: ApiErrorCode;
    changed: ApiErrorCode;
    regular: ApiErrorCode;
    write: ApiErrorCode;
  };
}
function binary(text: string) {
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value === 127 || (value < 32 && ![9, 10, 12, 13].includes(value))) return true;
  }
  return false;
}
const revision = (info: Stats, bytes: Buffer) =>
  createHash("sha256")
    .update(JSON.stringify([info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs, info.mode]))
    .update(bytes)
    .digest("hex");

/** PR 18 filesystem primitive, shared by workspace text and fixed agent memory. No logging. */
export async function readBoundedText(policy: TextFilePolicy) {
  const target = await policy.resolve();
  if (!target.info?.isFile())
    throw new AppError(400, policy.codes.regular, "Only regular text files are supported");
  if (target.info.size > policy.limit)
    throw new AppError(413, policy.codes.large, "Text exceeds the editor byte limit");
  const handle = await open(
    target.path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1)
      throw new AppError(400, policy.codes.regular, "Only regular text files are supported");
    if (info.size > policy.limit)
      throw new AppError(413, policy.codes.large, "Text exceeds the editor byte limit");
    const buffer = Buffer.alloc(policy.limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > policy.limit)
      throw new AppError(413, policy.codes.large, "Text exceeds the editor byte limit");
    const after = await handle.stat();
    if (
      info.size !== after.size ||
      info.mtimeMs !== after.mtimeMs ||
      info.ctimeMs !== after.ctimeMs
    )
      throw new AppError(
        409,
        policy.codes.changed,
        "Text changed while reading. Reload and try again.",
      );
    const bytes = buffer.subarray(0, length);
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new AppError(415, policy.codes.binary, policy.readBinaryMessage);
    }
    if (binary(content)) throw new AppError(415, policy.codes.binary, policy.readBinaryMessage);
    await policy.resolve();
    return {
      content,
      size: length,
      modifiedAt: info.mtime.toISOString(),
      revision: revision(info, bytes),
    };
  } finally {
    await handle.close();
  }
}
export async function writeRevisionText(
  policy: TextFilePolicy,
  content: string,
  expectedRevision: string,
) {
  if (Buffer.byteLength(content, "utf8") > policy.limit)
    throw new AppError(413, policy.codes.large, "Text exceeds the editor byte limit");
  if (
    binary(content) ||
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.from(content)) !==
      content
  )
    throw new AppError(415, policy.codes.binary, "Only valid UTF-8 text can be saved");
  const conflict = () =>
    new AppError(
      409,
      policy.codes.changed,
      "Changed on disk. Reload before saving; your edits have been kept.",
    );
  if ((await readBoundedText(policy)).revision !== expectedRevision) throw conflict();
  const target = await policy.resolve();
  if (!target.info || !(target.info.mode & 0o222))
    throw new AppError(403, policy.codes.write, "Text is read-only on the host filesystem");
  await access(target.path, constants.W_OK);
  const temp = join(dirname(target.path), `.qelvra-files-tmp-${randomUUID()}`);
  let ownsTemp = false;
  try {
    const handle = await open(
      temp,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      target.info.mode & 0o777,
    );
    ownsTemp = true;
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await policy.validateParent();
    if ((await readBoundedText(policy)).revision !== expectedRevision) throw conflict();
    await rename(temp, target.path);
    ownsTemp = false;
  } finally {
    if (ownsTemp) {
      await policy.validateParent();
      await unlink(temp);
    }
  }
  return readBoundedText(policy);
}
