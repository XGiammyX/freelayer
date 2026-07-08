// Shared helpers for FreeLayer guardrail scripts. Node-only, zero dependencies.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".git", "coverage", "src-tauri"]);

/** Recursively collect files under `root` whose extension is in `exts`. */
export function walkFiles(root, exts) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        out.push(...walkFiles(full, exts));
      }
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/** Read a file and return its lines. */
export function fileLines(path) {
  return readFileSync(path, "utf8").split(/\r?\n/);
}

/** POSIX-style path relative to the repo root, for stable reports. */
export function repoRelative(root, path) {
  return relative(root, path).split(sep).join("/");
}

/** Print violations and exit non-zero if any exist. */
export function report(checkName, violations) {
  if (violations.length === 0) {
    console.log(`[${checkName}] OK — no violations found.`);
    return;
  }
  console.error(`[${checkName}] FAILED — ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

export function repoRoot() {
  // Scripts are always invoked from the repo root via pnpm scripts.
  return process.cwd();
}

export function isPathExisting(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
