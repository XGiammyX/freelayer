// RoomOS bypass guard (TECH-16, docs/SOVEREIGN_ROOMS.md).
//
// Room state is derived and policy-controlled: apps must never mutate room
// materialized state directly, log room payloads, claim active endpoint
// defense, or pull in CRDT/sync engines before Gate H. Static token scan;
// AST-level bans (fetch/network/storage globals) live in eslint.config.mjs and
// the other guards — this adds RoomOS-specific patterns only.
//
// Usage: node scripts/check-no-roomos-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Direct mutation of derived room state (projection must stay immutable).
  ".objects.push(",
  ".members.push(",
  ".objects.splice(",
  ".members.splice(",
  // Room/event payload logging.
  "console.log(room",
  "console.log(event",
  "console.error(room",
  "console.error(event",
  // Endpoint-defense overclaims (externalized — hook-only).
  "endpointDefenseActive: true",
  "screenShieldActive: true",
  'endpointDefenseIntegration: "active"',
  // CRDT / sync engines are Gate H decisions — none may be imported.
  'from "yjs"',
  "from 'yjs'",
  'from "automerge"',
  "from '@automerge",
  'from "@automerge',
  'from "loro-crdt"',
  "from 'loro-crdt'",
  'from "loro',
];

// TECH-17: full-event serialization in shipped RoomOS source leaks payloads.
FORBIDDEN.push("JSON.stringify(event", "JSON.stringify(room");

// TECH-17: the projector/replay/log modules must be DETERMINISTIC — no clock,
// no randomness (injected boundaries only, in room-event-v1 creation).
const DETERMINISTIC_FILES = [
  "packages/rooms/src/room-reducer.ts",
  "packages/rooms/src/room-log.ts",
  "packages/rooms/src/room-lifecycle.ts",
];
const NONDETERMINISTIC_TOKENS = ["Date.now(", "Math.random(", "new Date("];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(relPath) {
  return relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx");
}

const args = process.argv.slice(2);
const scanDirs = args.length > 0 && !args[0].startsWith("--") ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const rel = repoRelative(root, file);
    if (isAllowlisted(rel)) {
      continue;
    }
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — RoomOS bypass pattern "${token}" ` +
              "(room state is policy-controlled and derived — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
    });
  }
}

// Determinism scan over the projector/replay/log modules.
for (const rel of DETERMINISTIC_FILES) {
  const abs = join(root, rel);
  try {
    const lines = fileLines(abs);
    lines.forEach((line, index) => {
      for (const token of NONDETERMINISTIC_TOKENS) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — nondeterministic call "${token}" in a replay/projection module ` +
              "(clocks/IDs are injected at event creation only — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
    });
  } catch {
    // Module not present (e.g. fixture-mode scans) — existence is covered by tests.
  }
}

report("check:no-roomos-bypass", violations);
