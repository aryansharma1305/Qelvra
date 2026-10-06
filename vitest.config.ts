import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    // Integration files own real PTYs and watchdogs. Bound parallel processes for stable local/CI cleanup.
    maxWorkers: 2,
  },
});
