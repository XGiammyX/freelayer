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

// ---- Zero-egress host allowlists (TECH-09) ----
//
// Remote HOSTS permitted to appear as strings in source/build. This is NOT an
// egress permission — it is an acknowledgement that these strings are benign:
//
//   github.com   — navigation anchors in the landing page (user-initiated;
//                  never fetched automatically). No automatic-egress API acts
//                  on them (verified by the runtime trap + forbidden-network
//                  scan finding no fetch/WebSocket/etc. in our own code).
//   www.w3.org   — XML/SVG namespace identifiers baked into React DOM. Never
//                  fetched; used by createElementNS.
//   react.dev    — error-decoder links embedded in React production error
//                  messages. Shown as text only if an error occurs.
//
// Any other remote host is a finding.
export const NAV_ALLOWED_HOSTS = ["github.com"];
export const FRAMEWORK_BENIGN_HOSTS = ["www.w3.org", "react.dev"];
export const BUILD_ALLOWED_HOSTS = [...NAV_ALLOWED_HOSTS, ...FRAMEWORK_BENIGN_HOSTS];

const URL_RE = /\b(?:https?|wss?):\/\/([a-z0-9.-]+)(?::\d+)?/gi;

/** Extract remote hosts from http(s)/ws(s) URLs in a line. Lowercased. */
export function extractRemoteHosts(line) {
  const hosts = [];
  for (const match of line.matchAll(URL_RE)) {
    if (match[1]) {
      hosts.push(match[1].toLowerCase());
    }
  }
  return hosts;
}

/** True if a host is in the given allowlist (exact match or subdomain). */
export function hostAllowed(host, allowlist) {
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
