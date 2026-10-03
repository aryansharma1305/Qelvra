import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/**
 * Replaces `file` so readers only ever see the old or the new contents, never a partial
 * write: write a temp file in the same directory (same filesystem, so rename is atomic),
 * flush it to disk, rename it over the target, then flush the directory entry.
 */
export async function writeFileAtomic(file: string, data: string): Promise<void> {
  const dir = dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = join(dir, `.${basename(file)}.${process.pid}.${randomUUID()}.tmp`);

  try {
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }

  // Make the rename itself durable. Not every platform can fsync a directory.
  try {
    const directory = await open(dir, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch {
    // best effort
  }
}
