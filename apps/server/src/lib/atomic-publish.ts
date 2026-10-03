import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, open, unlink } from "node:fs/promises";
import { join } from "node:path";

/** Fixed server-owned names only. Atomic visibility, exclusive publication, no overwrite. */
export async function publishFileExclusive(
  directory: string,
  filename: string,
  data: string,
  checkDirectory: () => Promise<unknown>,
  durable = false,
): Promise<void> {
  const temporary = join(directory, `.tmp-${filename}-${randomUUID()}`);
  let ownsTemp = false;
  let published = false;
  let failure: unknown;
  try {
    await checkDirectory();
    const handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    ownsTemp = true;
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await checkDirectory();
    await link(temporary, join(directory, filename));
    published = true;
    if (durable) await syncDirectory(directory);
  } catch (error) {
    failure = error;
  } finally {
    if (ownsTemp) {
      try {
        await checkDirectory();
        await unlink(temporary);
      } catch (error) {
        if (!published && (error as NodeJS.ErrnoException).code !== "ENOENT") failure = error;
      }
    }
  }
  if (failure) throw failure;
}

/** POSIX directory durability barrier, required before a delivery source is removed. */
export async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
