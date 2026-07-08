// Baseline import-boundary check (docs/ARCHITECTURE.md — non-bypassable rules).
//
// Enforces the dependency-direction rules at the source level: which
// @freelayer/* packages each workspace unit may import. This is a BASELINE
// static scan, not a proof — it reduces accidental bypass, it does not stop
// determined circumvention.
//
// TODO (Gate A / Phase 10):
// - replace or augment with dependency-graph tooling (evaluate
//   dependency-cruiser / eslint-plugin-boundaries per docs/DEPENDENCY_POLICY.md)
// - AST-based import extraction instead of regex
// - compile-time PolicyDecision requirements in side-effect modules
import { join } from "node:path";
import { fileLines, isPathExisting, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

// Allowed @freelayer/* imports per workspace unit. Anything not listed is a
// violation. Units not in this map may import nothing from the workspace.
const RULES = {
  "apps/web": ["ui", "sdk", "core", "privacy"],
  "apps/desktop": ["ui", "sdk", "core", "privacy"],
  "apps/docs": [],
  "apps/relay": [],
  "packages/core": [
    "privacy",
    "security",
    "storage",
    "transports",
    "crypto",
    "protocol",
    "capsules",
    "rooms",
    "ai",
  ],
  "packages/sdk": ["core", "privacy", "security"],
  "packages/ui": [],
  "packages/privacy": ["security"],
  "packages/security": [],
  "packages/crypto": [],
  "packages/protocol": [],
  "packages/storage": ["privacy", "security"],
  "packages/transports": ["privacy", "security"],
  "packages/ai": ["privacy", "security"],
  "packages/capsules": ["protocol", "privacy", "security"],
  "packages/rooms": ["privacy", "security", "protocol", "capsules"],
};

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\(\s*)["'](@freelayer\/([a-z-]+))["']/g;

const root = repoRoot();
const violations = [];

for (const [unit, allowed] of Object.entries(RULES)) {
  const srcDir = join(root, unit, "src");
  if (!isPathExisting(srcDir)) {
    continue;
  }
  const selfName = unit.split("/")[1];
  for (const file of walkFiles(srcDir, [".ts", ".tsx"])) {
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(IMPORT_RE)) {
        const target = match[2];
        if (target === selfName) {
          continue;
        }
        if (!allowed.includes(target)) {
          violations.push(
            `${repoRelative(root, file)}:${index + 1} — "${unit}" must not import "@freelayer/${target}" ` +
              `(allowed: ${allowed.length > 0 ? allowed.map((a) => `@freelayer/${a}`).join(", ") : "none"})`,
          );
        }
      }
    });
  }
}

report("check:boundaries", violations);
