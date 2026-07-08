// Forbidden direct-storage guard (docs/STORAGE_MODEL.md — write barrier,
// ADR-0005). All persistence must flow through @freelayer/storage providers
// carrying a PolicyDecision; direct browser storage APIs are forbidden in
// feature code.
//
// Test files (*.test.ts/tsx) are exempt per policy ("approved tests"), and
// markdown/docs are not scanned. This is a baseline token scan.
//
// TODO (Phase 10):
// - AST-based detection (member expressions, aliasing) instead of tokens
// - integrate with dependency-direction tooling
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const STORAGE_TOKEN = ["local", "Storage"].join(""); // avoid self-matching
const SESSION_TOKEN = ["session", "Storage"].join("");
const IDB_TOKEN = ["indexed", "DB"].join("");

const FORBIDDEN = [
  STORAGE_TOKEN,
  `window.${STORAGE_TOKEN}`,
  SESSION_TOKEN,
  IDB_TOKEN,
  `window.${IDB_TOKEN}`,
  "caches.open",
  "navigator.sendBeacon",
  "document.cookie",
  "openDatabase",
];

const SCAN_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".html"];

const root = repoRoot();
const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) {
      continue;
    }
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${repoRelative(root, file)}:${index + 1} — forbidden storage/beacon API "${token}" ` +
              "(all persistence must pass the StoragePolicy write barrier — ADR-0005)",
          );
        }
      }
    });
  }
}

report("check:no-forbidden-storage", violations);
