// Fail closed if a release restores one of the unverified assets or drifts from its provenance.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const audit = JSON.parse(readFileSync(resolve(root, "docs/release/asset-audit.json"), "utf8"));
const originals = [
  "avatar-atlas.jpg",
  "avatar-michael.jpg",
  "avatar-nova-portrait.jpg",
  "avatar-scout.jpg",
  "avatar-user.jpg",
  "brand-mark.png",
  "brand-mark.svg",
];
assert.equal(audit.assets.length, originals.length);
assert.deepEqual(
  audit.assets.map((a) => a.originalPath).sort(),
  originals.map((p) => "apps/web/public/stitch/" + p).sort(),
);
for (const asset of audit.assets) {
  assert.equal(asset.status, "REPLACED", `Unresolved artwork: ${asset.originalPath}`);
  assert.equal(
    existsSync(resolve(root, asset.originalPath)),
    false,
    `Unverified artwork restored: ${asset.originalPath}`,
  );
  assert.match(asset.replacementPath, /^apps\/web\/public\/artwork\/[a-z-]+\.svg$/);
  assert.equal(asset.license, "Apache-2.0");
  assert.equal(asset.copyright, "Copyright 2026 Aryan Sharma and Qelvra contributors");
  assert.ok(asset.evidence.trim());
  const bytes = readFileSync(resolve(root, asset.replacementPath));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.replacementSha256);
  assert.match(bytes.toString(), /SPDX-License-Identifier: Apache-2.0/);
  assert.doesNotMatch(
    bytes.toString(),
    /<script|<image|<foreignObject|\b(?:href|onload|onclick)=/i,
  );
}
console.log(
  "All seven distribution assets resolved: REPLACED by original Apache-2.0 Qelvra artwork.",
);
