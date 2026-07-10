// Metadata-bypass guard (TECH-10, docs/METADATA_MODEL.md — Metadata Firewall).
//
// Metadata-producing behavior must pass MetadataPolicy (packages/privacy). This
// guard catches direct, call/construct-shaped uses of metadata-leaking browser
// APIs and app-signal emitter helper names OUTSIDE the approved policy modules
// and tests.
//
// HONEST LIMITATIONS (documented, docs/audits/TECH_10_METADATA_FIREWALL_AUDIT.md):
//   - This is a static, token-based scan, not a proof. Aliasing, dynamic
//     property access, or computed names evade it.
//   - It is intentionally NARROW to avoid flagging prose, type names, or the
//     policy vocabulary. Broad words like "presence"/"notification" are NOT
//     scanned — the semantic emitter names below are. AST-level global bans
//     (fetch/WebSocket/RTCPeerConnection/storage) live in eslint.config.mjs;
//     this guard only adds metadata-specific patterns ESLint does not cover.
//
// Usage: node scripts/check-no-metadata-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

// Dangerous, call/construct-shaped patterns. Specific enough that prose and the
// policy vocabulary (dotted event strings like "notification.show") do not match.
const FORBIDDEN = [
  "new Notification(",
  "Notification.requestPermission",
  "navigator.setAppBadge",
  "navigator.clearAppBadge",
  "navigator.setClientBadge",
  "document.title =",
  "document.title=",
  // App-signal emitters must not be hand-rolled outside the policy layer.
  "emitReadReceipt",
  "sendReadReceipt",
  "emitTypingIndicator",
  "sendTypingIndicator",
  "broadcastPresence",
  "publishPresence",
  "emitPresence",
  "setOnlineStatus",
  "updateLastSeen",
  // Link-preview / OpenGraph fetchers are content-adjacent egress.
  "fetchLinkPreview",
  "fetchOpenGraph",
  "loadOpenGraph",
  "fetchLinkMetadata",
];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".html", ".mjs"];

// Approved metadata policy modules legitimately reference the vocabulary; they
// contain no call-shaped emitters, but we allowlist them defensively.
function isAllowlisted(relPath) {
  return (
    relPath.includes("packages/privacy/src/metadata") ||
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx") ||
    relPath.includes("/fixtures/")
  );
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
            `${rel}:${index + 1} — metadata-leaking pattern "${token}" ` +
              "(metadata-producing behavior must pass MetadataPolicy — docs/METADATA_MODEL.md)",
          );
        }
      }
    });
  }
}

report("check:no-metadata-bypass", violations);
