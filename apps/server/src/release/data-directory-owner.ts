import { mkdir, lstat, realpath, writeFile, readFile, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { StartupValidationError } from "./startup-validation.js";

/** Atomic directory claim; stale claims never get guessed away after a crash. */
export async function acquireDataDirectory(dataDir: string) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const root = await lstat(dataDir);
  if (!root.isDirectory() || root.isSymbolicLink())
    throw new StartupValidationError("server ownership", dataDir, "is not a real directory");
  const lock = join(await realpath(dataDir), ".server-owner");
  const token = randomUUID();
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch {
    throw new StartupValidationError(
      "server ownership",
      lock,
      "has an owner or an unreleased crash lock; verify all Qelvra servers are stopped before moving the lock aside",
    );
  }
  const identity = await lstat(lock);
  try {
    await writeFile(join(lock, "token"), token, { flag: "wx", mode: 0o600 });
  } catch (error) {
    await rmdir(lock).catch(() => undefined);
    throw error;
  }
  let released = false;
  return {
    async release() {
      if (released) return;
      const current = await lstat(lock);
      const file = await lstat(join(lock, "token"));
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        current.ino !== identity.ino ||
        current.dev !== identity.dev ||
        !file.isFile() ||
        file.isSymbolicLink() ||
        file.size > 100 ||
        file.nlink !== 1 ||
        (await readFile(join(lock, "token"), "utf8")) !== token
      )
        throw new Error("Server ownership changed; refusing to release it");
      await unlink(join(lock, "token"));
      await rmdir(lock);
      released = true;
    },
  };
}
