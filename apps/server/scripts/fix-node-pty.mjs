// node-pty's macOS/Linux prebuilds ship `spawn-helper` without the executable bit in some
// npm installs, which makes every spawn fail with "posix_spawnp failed". Restore it after
// install. Runs as this package's postinstall; harmless when already executable.
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

if (process.platform === "win32") process.exit(0);

let packageDir;
try {
  packageDir = dirname(createRequire(import.meta.url).resolve("node-pty/package.json"));
} catch {
  process.exit(0); // node-pty not installed (e.g. production install without it)
}

const candidates = [join(packageDir, "build", "Release", "spawn-helper")];
const prebuilds = join(packageDir, "prebuilds");
if (existsSync(prebuilds)) {
  for (const target of readdirSync(prebuilds)) {
    candidates.push(join(prebuilds, target, "spawn-helper"));
  }
}

for (const file of candidates) {
  if (!existsSync(file)) continue;
  const mode = statSync(file).mode;
  if ((mode & 0o111) !== 0o111) {
    chmodSync(file, mode | 0o755);
    console.log(`fix-node-pty: made ${file} executable`);
  }
}
