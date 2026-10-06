// Keep legal notices beside both built distributions; upstream license bytes stay intact.
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const target = process.argv[2];
if (!["server", "web"].includes(target)) throw new Error("Expected server or web notice target");
const out = resolve(root, "apps", target, "dist");
await mkdir(out, { recursive: true });
for (const file of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"])
  await copyFile(resolve(root, file), resolve(out, file));
let text =
  "Qelvra third-party notices\nUpstream copyright and license text is reproduced verbatim below.\n\n";
const licenses = resolve(root, "third-party/licenses");
for (const file of (await readdir(licenses)).sort()) {
  text += `\n===== ${file} =====\n\n` + (await readFile(resolve(licenses, file), "utf8")) + "\n";
}
await writeFile(resolve(out, "THIRD_PARTY_NOTICES.txt"), text);
