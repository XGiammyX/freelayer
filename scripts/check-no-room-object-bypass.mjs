// RoomOS object-model bypass guard (TECH-18, docs/SOVEREIGN_ROOMS.md).
//
// Object mutations must go through the explicit, policy-gated command pipeline:
// no direct projection mutation, no generic/JSON patch, no unvalidated spread
// into domain objects, no prototype-pollution keys, no content serialization,
// no HTML/Markdown rendering, no link preview, no file/path/URL access, no
// network/notification, no CRDT/crypto/AI/endpoint-monitoring imports, no
// active ScreenShield flags. Static token scan; AST-level global bans live in
// eslint.config.mjs and the other guards.
//
// Usage: node scripts/check-no-room-object-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Direct mutation of the derived object projection.
  ".objects.push(",
  ".objects.splice(",
  ".objects.pop(",
  ".objects.shift(",
  // Generic / arbitrary patching — explicit commands only.
  "object.patch",
  "object.update_any",
  "set_property",
  "merge_payload",
  "json_patch",
  "jsonpatch",
  "fast-json-patch",
  "rfc6902",
  // Prototype pollution vectors.
  "__proto__",
  '["constructor"]',
  '["prototype"]',
  // Content serialization in shipped source (leaks object bodies).
  "JSON.stringify(command",
  "JSON.stringify(object",
  "JSON.stringify(mutation",
  // Rendering / preview — plain text only, never rendered here.
  "dangerouslySetInnerHTML",
  ".innerHTML",
  "marked(",
  'from "marked"',
  'from "markdown-it"',
  'from "dompurify"',
  "createLinkPreview",
  "fetchPreview",
  // File / path / URL access — file refs hold none.
  "readFileSync(",
  "fs.readFile",
  'from "node:fs"',
  "URL.createObjectURL",
  // Network / notification.
  "fetch(",
  "new WebSocket(",
  "new RTCPeerConnection(",
  "new Notification(",
  // CRDT / crypto / AI / endpoint-monitoring imports.
  'from "yjs"',
  'from "@automerge',
  'from "loro',
  'from "@freelayer/crypto"',
  "node:crypto",
  'from "@freelayer/ai"',
  "iohook",
  "robotjs",
  // Endpoint-defense overclaims (externalized — hook-only).
  "endpointDefenseActive: true",
  "screenShieldActive: true",
  'endpointDefenseState: "active"',
];

// The object reducer/log/lifecycle/redaction modules must be DETERMINISTIC —
// clocks/IDs are injected only at the pipeline creation boundary.
const DETERMINISTIC_FILES = [
  "packages/rooms/src/objects/object-reducer.ts",
  "packages/rooms/src/objects/object-log.ts",
  "packages/rooms/src/objects/object-lifecycle.ts",
  "packages/rooms/src/objects/object-redaction.ts",
];
const NONDETERMINISTIC_TOKENS = ["Date.now(", "Math.random(", "new Date("];

// Assignment INTO a projection collection element (a direct-mutation bypass).
const PROJECTION_ASSIGN_RE = /\.(objects|members)\[[^\]]*\]\s*=[^=]/;

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    // The command validator legitimately NAMES dangerous keys to reject them.
    rel.endsWith("objects/object-validation.ts") ||
    rel.endsWith("objects/object-commands.ts") ||
    rel.endsWith("check-no-room-object-bypass.mjs")
  );
}

const args = process.argv.slice(2);
const scanDirs = args.length > 0 && !args[0].startsWith("--") ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const rel = repoRelative(root, file);
    if (isAllowlisted(rel)) continue;
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — object-model bypass pattern "${token}" ` +
              "(mutations go through the policy-gated command pipeline — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
      if (PROJECTION_ASSIGN_RE.test(line)) {
        violations.push(
          `${rel}:${index + 1} — direct assignment into a room projection collection ` +
            "(projection is immutable; rebuild via the reducer — docs/SOVEREIGN_ROOMS.md)",
        );
      }
    });
  }
}

for (const rel of DETERMINISTIC_FILES) {
  const abs = join(root, rel);
  try {
    const lines = fileLines(abs);
    lines.forEach((line, index) => {
      for (const token of NONDETERMINISTIC_TOKENS) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — nondeterministic call "${token}" in an object reducer/log module ` +
              "(clocks/IDs are injected at the pipeline boundary only — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
    });
  } catch {
    // Module absent (e.g. fixture-mode scans) — existence is covered by tests.
  }
}

report("check:no-room-object-bypass", violations);
