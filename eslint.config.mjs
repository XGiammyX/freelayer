// FreeLayer ESLint flat config (chore/stabilize-and-harden).
//
// Two jobs:
//   1. Baseline TypeScript hygiene (typescript-eslint recommended, light).
//   2. AST-BACKED enforcement of the constitution — the definitive upgrade of
//      the regex guardrails (docs/ARCHITECTURE.md non-bypassable rules):
//        - apps may not import side-effect packages directly (rules 1/12);
//        - no direct browser storage / network globals in shipped code
//          (rules 7/8, ADR-0005/0008, docs/STORAGE_MODEL.md, NETWORK_MODEL.md).
//      These fire at lint time on the real AST — no aliasing/comment noise —
//      complementing (not replacing) the CI regex scanners.
//
// Scope note: tests, fixtures, test helpers, and scripts are development
// tooling that legitimately reference these APIs (trap helpers, guardrail
// scanners) — they get baseline hygiene only, and their egress is covered by
// the runtime trap + regex scanners.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** Browser network/storage globals forbidden in shipped app/package code. */
const FORBIDDEN_GLOBALS = [
  { name: "localStorage", message: "Direct localStorage is forbidden. Use @freelayer/storage (write barrier, ADR-0005)." },
  { name: "sessionStorage", message: "Direct sessionStorage is forbidden. Use @freelayer/storage (ADR-0005)." },
  { name: "indexedDB", message: "Direct IndexedDB is forbidden. Use @freelayer/storage (ADR-0005)." },
  { name: "caches", message: "Direct CacheStorage is forbidden (ADR-0005)." },
  { name: "fetch", message: "Direct fetch is forbidden. Network must go through the NetworkPolicy barrier (ADR-0002/0008)." },
  { name: "XMLHttpRequest", message: "Direct XMLHttpRequest is forbidden (NetworkPolicy barrier, ADR-0002/0008)." },
  { name: "WebSocket", message: "Direct WebSocket is forbidden (NetworkPolicy barrier, ADR-0002/0008)." },
  { name: "EventSource", message: "Direct EventSource is forbidden (NetworkPolicy barrier, ADR-0002/0008)." },
  { name: "RTCPeerConnection", message: "Direct WebRTC is forbidden — real-IP exposure (NetworkPolicy, ADR-0008)." },
];

/** @freelayer packages apps must never import directly (they use ui/sdk/core/privacy). */
const APP_FORBIDDEN_IMPORTS = [
  "@freelayer/storage",
  "@freelayer/transports",
  "@freelayer/crypto",
  "@freelayer/ai",
  "@freelayer/protocol",
  "@freelayer/capsules",
  "@freelayer/rooms",
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.d.ts",
      "wiki/**",
      "tests/fixtures/**",
    ],
  },

  // Baseline hygiene for all TypeScript.
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // The codebase uses explicit `unknown` + narrowing; `any` stays banned.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // AST-backed constitution enforcement: shipped app + package source only.
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-globals": ["error", ...FORBIDDEN_GLOBALS],
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: APP_FORBIDDEN_IMPORTS.map((name) => ({
            name,
            message:
              "Apps must not import side-effect packages directly. Go through @freelayer/sdk or @freelayer/core (ARCHITECTURE.md rules 1/12).",
          })),
        },
      ],
    },
  },

  // Development tooling: baseline hygiene only.
  {
    files: ["tests/**/*.{ts,tsx}", "scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
