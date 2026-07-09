// Forbidden direct-storage guard (docs/STORAGE_MODEL.md — write barrier,
// ADR-0005). All persistence must flow through @freelayer/storage providers
// carrying a PolicyDecision; direct storage APIs are forbidden in source.
//
// Usage: node scripts/check-no-forbidden-storage.mjs [dir ...]
//   Default dirs: apps, packages. Extra dirs are for the guardrail's own
//   tests (fixtures under tests/ are never scanned by default).
//
// Allowlist policy: markdown/docs are not scanned; this script itself lives
// in scripts/ (not scanned); *.test.ts files are exempt ("approved tests");
// fixtures are only scanned when explicitly passed as arguments.
//
// TODO (Phase 10): AST-based detection (member expressions, aliasing) and
// integration with dependency-direction tooling.
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const STORAGE_TOKEN = ["local", "Storage"].join(""); // avoid self-matching in scans of scripts/
const SESSION_TOKEN = ["session", "Storage"].join("");
const IDB_TOKEN = ["indexed", "DB"].join("");

const FORBIDDEN = [
  STORAGE_TOKEN,
  `window.${STORAGE_TOKEN}`,
  SESSION_TOKEN,
  `window.${SESSION_TOKEN}`,
  IDB_TOKEN,
  `window.${IDB_TOKEN}`,
  "caches.open",
  "CacheStorage",
  "navigator.serviceWorker",
  "navigator.sendBeacon",
  "document.cookie",
  "openDatabase",
  "serviceWorker.register",
  "showSaveFilePicker",
  "showOpenFilePicker",
  "showDirectoryPicker",
  "FileSystemWritableFileStream",
  "storage.persist(",
  "fs.writeFile",
  "fs.appendFile",
  "promises.writeFile",
  "writeFileSync",
  "appendFileSync",
  "Deno.writeFile",
  "Bun.write",
  "sqlite",
  "@tauri-apps/plugin-fs",
  "@tauri-apps/api/fs",
];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".html", ".mjs"];

const root = repoRoot();
const scanDirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_DIRS;
const violations = [];

for (const dir of scanDirs) {
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
