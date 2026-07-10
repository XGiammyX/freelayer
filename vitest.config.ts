import { defineConfig } from "vitest/config";

// Test suites live under tests/ and import workspace packages by name.
// - unit/               — package-level behavior
// - privacy-regression/ — machine-checked privacy invariants (see docs/PRIVACY_MODEL.md)
// - security-regression/— security invariants incl. guardrail-script tests
// No browser environment, no network, no automation — see tests/README.md.
export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/privacy-regression/**/*.test.ts",
      "tests/security-regression/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      // Measured on the shipped source; reported for regression visibility.
      // No hard threshold yet — the suite is scaffolding + policy logic, and a
      // premature gate would reward coverage theater. Revisit at Gate B.
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts"],
      reporter: ["text-summary"],
    },
  },
});
