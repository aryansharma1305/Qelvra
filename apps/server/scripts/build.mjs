// Bundles the server into dist/index.js. Workspace packages (@qelvra/shared, shipped as
// TypeScript source) are inlined; npm dependencies stay external and load from node_modules.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@qelvra/"));

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
});
