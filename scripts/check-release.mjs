// Publishing is fail-closed. Normal CI can validate a candidate awaiting owner decisions.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
assert.ok(
  ["LICENSE", "LICENSE.md", "LICENSE.txt"].some(
    (file) => existsSync(file) && readFileSync(file, "utf8").trim(),
  ),
  "Release blocked: repository owner must select and record a license.",
);
assert.equal(
  createHash("sha256").update(readFileSync("LICENSE")).digest("hex"),
  "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
  "Release blocked: canonical Apache-2.0 license text changed.",
);
assert.ok(readFileSync("NOTICE", "utf8").includes("Aryan Sharma"));
for (const path of [
  "package.json",
  "apps/server/package.json",
  "apps/web/package.json",
  "packages/shared/package.json",
]) {
  assert.equal(
    JSON.parse(readFileSync(path, "utf8")).version,
    "0.1.0-beta.1",
    `Inconsistent version: ${path}`,
  );
  assert.equal(JSON.parse(readFileSync(path, "utf8")).license, "Apache-2.0");
}
assert.equal(process.env.RELEASE_TAG, "v0.1.0-beta.1", "Unexpected release tag");
assert.match(
  readFileSync("docs/release/v0.1-beta-checklist.md", "utf8"),
  /^Recommendation: SHIP$/m,
  "Release blocked: checklist still has unresolved gates.",
);
assert.doesNotMatch(
  readFileSync("docs/release/v0.1-beta-checklist.md", "utf8"),
  /\|\s*FAIL\s*\|/,
  "Release blocked: checklist contains failed gates.",
);
console.log("License, version, tag and completed checklist approved.");
