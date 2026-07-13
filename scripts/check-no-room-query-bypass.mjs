// RoomOS query bypass guard (TECH-19, docs/SOVEREIGN_ROOMS.md).
//
// Reads must go through the approved, policy-gated, side-effect-free query API:
// no query history/cache/persistent index, no full-text-search dependency, no
// dynamic RegExp from query input, no query/result serialization in logs, no
// query-term logging, no network/notification/AI/file access from queries, no
// active ScreenShield claim. Static token scan; AST-level global bans live in
// eslint.config.mjs and the other guards.
//
// Usage: node scripts/check-no-room-query-bypass.mjs [dir ...]
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  // Query history / result cache / persistent search index.
  "queryHistory.push",
  "queryHistory[",
  "searchHistory",
  "recentSearches",
  "resultCache.set",
  "resultCache[",
  "searchIndex.add",
  "buildSearchIndex",
  "persistIndex",
  // Full-text-search dependencies.
  'from "fuse.js"',
  'from "lunr"',
  'from "minisearch"',
  'from "flexsearch"',
  'from "elasticlunr"',
  // Dynamic RegExp from query input (ReDoS / over-matching).
  "new RegExp(term",
  "new RegExp(query",
  "new RegExp(input",
  // Query / result serialization in shipped source (leaks terms/content).
  "JSON.stringify(query",
  "JSON.stringify(request",
  "JSON.stringify(result",
  "JSON.stringify(cursor",
  // Query-term logging.
  "console.log(term",
  "console.log(query",
  "console.error(query",
  // Persistence / storage from queries.
  "localStorage",
  "sessionStorage",
  "indexedDB",
  // Rendering / preview / file / network from queries.
  ".innerHTML",
  "dangerouslySetInnerHTML",
  "createLinkPreview",
  "readFileSync(",
  'from "node:fs"',
  "fetch(",
  "new WebSocket(",
  "new Notification(",
  // AI / endpoint-monitoring imports.
  'from "@freelayer/ai"',
  "node:crypto",
  "iohook",
  "robotjs",
  // Endpoint-defense overclaims.
  "captureProtected: true",
  "screenShieldActive: true",
  'endpointIntegration: "active"',
];

// The query modules must be DETERMINISTIC and side-effect-free — no clock,
// no randomness in the read path.
const DETERMINISTIC_FILES = [
  "packages/rooms/src/query/query-executor.ts",
  "packages/rooms/src/query/query-search.ts",
  "packages/rooms/src/query/query-redaction.ts",
  "packages/rooms/src/query/query-policy.ts",
];
const NONDETERMINISTIC_TOKENS = ["Date.now(", "Math.random(", "new Date("];

// Direct traversal of a raw room projection OUTSIDE the approved query package
// (apps/core must go through the query API, not scan `roomState.objects`).
const RAW_TRAVERSAL_RE =
  /roomState\.objects\.(find|filter|map|forEach|reduce|some|every|sort|slice)\b/;

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".mjs"];
const QUERY_PKG = "packages/rooms/src/query/";
const OBJECTS_PKG = "packages/rooms/src/objects/";

function isAllowlisted(rel) {
  return (
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx") ||
    rel.endsWith("check-no-room-query-bypass.mjs")
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
    const inApprovedPkg = rel.includes(QUERY_PKG) || rel.includes(OBJECTS_PKG);
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (line.includes(token)) {
          violations.push(
            `${rel}:${index + 1} — query bypass pattern "${token}" ` +
              "(reads go through the policy-gated query API — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
      // Raw projection traversal is only allowed inside the query/objects pkgs.
      if (!inApprovedPkg && RAW_TRAVERSAL_RE.test(line)) {
        violations.push(
          `${rel}:${index + 1} — direct traversal of a raw room projection ` +
            "(use the approved RoomOS query API, not roomState.objects.* — docs/SOVEREIGN_ROOMS.md)",
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
            `${rel}:${index + 1} — nondeterministic call "${token}" in a query module ` +
              "(queries are deterministic and side-effect-free — docs/SOVEREIGN_ROOMS.md)",
          );
        }
      }
    });
  } catch {
    // Module absent (fixture-mode scans) — existence is covered by tests.
  }
}

report("check:no-room-query-bypass", violations);
