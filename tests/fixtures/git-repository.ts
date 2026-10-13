import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readdir, readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
const exec = promisify(execFile);
export async function fixtureGit(path: string, ...args: string[]) {
  return exec("git", args, {
    cwd: path,
    timeout: 5000,
    env: {
      PATH: process.env.PATH,
      HOME: path,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}
export async function fixtureRepository(root: string, committed = true) {
  await mkdir(root, { recursive: true });
  await fixtureGit(root, "init", "--initial-branch=main");
  if (committed) {
    await writeFile(join(root, "README.md"), "Disposable repository\n");
    await fixtureGit(root, "add", "README.md");
    await fixtureGit(root, "-c", "core.hooksPath=/dev/null", "commit", "-m", "Fixture");
  }
  return root;
}
/** Includes metadata contents and mtimes, but never follows links. */
export async function repositorySnapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isDirectory()) Object.assign(result, await repositorySnapshot(file));
    else if (entry.isFile()) {
      const s = await lstat(file);
      result[file] = `${s.mtimeMs}:${(await readFile(file)).toString("base64")}`;
    }
  }
  return result;
}
