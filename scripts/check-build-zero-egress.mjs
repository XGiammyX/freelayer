// Build artifact zero-egress scanner (TECH-09).
//
// Verifies the BUILT app makes no automatic network egress on load:
//   1. Authored HTML/CSS in the build carry no remote-asset markup.
//   2. No remote host outside the documented allowlist appears anywhere.
//   3. No analytics/telemetry/AI-endpoint host strings appear.
//
// It deliberately does NOT flag `fetch(` / `createElement('script')` tokens in
// minified JS: React DOM embeds these dormantly for its resource APIs and they
// are never triggered by our app (docs/research/ZERO_EGRESS_RESEARCH.md). The
// runtime trap (tests/privacy-regression/network/zero-egress.test.ts) is the
// real proof that no call fires on load.
//
// Usage: node scripts/check-build-zero-egress.mjs [dir ...]   (default: apps/web/dist)
import { join } from "node:path";
import {
  BUILD_ALLOWED_HOSTS,
  extractRemoteHosts,
  fileLines,
  hostAllowed,
  isPathExisting,
  report,
  repoRelative,
  repoRoot,
  walkFiles,
} from "./_util.mjs";

const DEFAULT_DIRS = ["apps/web/dist"];

// Remote-asset markup patterns — forbidden in built HTML/CSS (automatic egress).
const REMOTE_ASSET_PATTERNS = [
  'src="http',
  "src='http",
  'href="http', // stylesheet/font/preload hrefs; navigation <a> uses relative or is JS-driven
  "href='http",
  "url(http",
  "url('http",
  'url("http',
  "@import",
  "//fonts.",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "rel=preconnect",
  'rel="preconnect"',
  "dns-prefetch",
];

// Analytics / telemetry / AI endpoint host substrings — always a finding.
const FORBIDDEN_HOSTS = [
  "googletagmanager",
  "google-analytics",
  "plausible.io",
  "posthog.com",
  "sentry.io",
  "ingest.sentry",
  "datadoghq",
  "mixpanel.com",
  "segment.io",
  "segment.com",
  "amplitude.com",
  "api.openai.com",
  "api.anthropic.com",
];

const root = repoRoot();
const dirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_DIRS;
const violations = [];
const allowedHostsSeen = new Set();
let scannedAny = false;

for (const dir of dirs) {
  const abs = join(root, dir);
  if (!isPathExisting(abs)) {
    continue;
  }
  scannedAny = true;
  for (const file of walkFiles(abs, [".html", ".css", ".js", ".map", ".json", ".webmanifest"])) {
    const rel = repoRelative(root, file);
    const isMarkup = file.endsWith(".html") || file.endsWith(".css");
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      // 1. Remote-asset markup (HTML/CSS only — where it would auto-load).
      if (isMarkup) {
        for (const pattern of REMOTE_ASSET_PATTERNS) {
          if (line.includes(pattern)) {
            violations.push(
              `${rel}:${index + 1} — remote-asset markup "${pattern}" in built ${file.endsWith(".css") ? "CSS" : "HTML"}`,
            );
          }
        }
      }
      // 2. Forbidden analytics/telemetry/AI hosts (any file).
      const lower = line.toLowerCase();
      for (const host of FORBIDDEN_HOSTS) {
        if (lower.includes(host)) {
          violations.push(`${rel}:${index + 1} — forbidden analytics/telemetry/AI host "${host}"`);
        }
      }
      // 3. Any remote host outside the allowlist (any file).
      for (const host of extractRemoteHosts(line)) {
        if (hostAllowed(host, BUILD_ALLOWED_HOSTS)) {
          allowedHostsSeen.add(host);
        } else {
          violations.push(`${rel}:${index + 1} — remote host "${host}" not in the build allowlist`);
        }
      }
    });
  }
}

if (!scannedAny) {
  console.log(
    "[check:build-zero-egress] SKIPPED — no build output found. Run `pnpm build` first (CI builds before this check).",
  );
  process.exit(0);
}

if (allowedHostsSeen.size > 0) {
  console.log(
    `[check:build-zero-egress] allowlisted benign hosts present (not egress): ${[...allowedHostsSeen].sort().join(", ")}`,
  );
}
report("check:build-zero-egress", violations);
