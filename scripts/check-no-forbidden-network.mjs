// Forbidden network guard (docs/NETWORK_MODEL.md — network side-effect
// barrier, ADR-0002/0008). FreeLayer performs no network operations; direct
// network APIs are forbidden in source outside a future approved transport.
//
// Usage: node scripts/check-no-forbidden-network.mjs [dir ...]
//   Default dirs: apps, packages. Extra dirs support the guardrail's tests.
//
// Allowlist: markdown/docs not scanned; this script not scanned; *.test.ts
// exempt; fixtures only scanned when passed explicitly. Comments mentioning an
// API (e.g. "// no fetch") are tolerated by requiring a call-shaped or
// import-shaped match for the risky tokens.
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

// Call/construct/import-shaped patterns — deliberately specific to avoid
// flagging prose and identifiers.
const FORBIDDEN = [
  "fetch(",
  "window.fetch",
  "globalThis.fetch",
  "new XMLHttpRequest",
  "new WebSocket",
  "new EventSource",
  "new RTCPeerConnection",
  "RTCDataChannel",
  "navigator.sendBeacon",
  "importScripts(",
  "serviceWorker.register",
  'createElement("script")',
  "createElement('script')",
  "http://",
  "@tauri-apps/plugin-http",
  'require("http")',
  'require("https")',
  'require("net")',
  'require("dgram")',
  'require("tls")',
  'from "node:http"',
  'from "node:https"',
  'from "node:net"',
  'from "node:dgram"',
  'from "node:tls"',
  'from "axios"',
  'from "got"',
  'from "ky"',
  'from "superagent"',
  'from "request"',
  'from "node-fetch"',
];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".html", ".mjs", ".css"];

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
            `${repoRelative(root, file)}:${index + 1} — forbidden network API/import "${token}" ` +
              "(all network access must pass the NetworkPolicy barrier — ADR-0002/0008)",
          );
        }
      }
    });
  }
}

report("check:no-forbidden-network", violations);
