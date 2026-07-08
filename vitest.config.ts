import { defineConfig } from "vitest/config";

// Baseline unit tests live in tests/unit and import workspace packages by
// name (@freelayer/*). No browser environment, no network, no automation —
// see tests/README.md for suite rules.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
