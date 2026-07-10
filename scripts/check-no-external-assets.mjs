// Remote-asset guard (ADR-0008, docs/NO_EXTERNAL_ASSETS_POLICY.md).
// TECH-09 turned this into a remote-asset scanner; TECH-11 hardens it for
// link-preview / external-asset blocking (CDNs, protocol-relative assets,
// connection hints, tracking pixels, OpenGraph/Twitter-card images, remote
// avatars).
//
// Fails on remote-asset patterns in app/package SOURCE files: remote images,
// fonts, stylesheets, scripts, CSS url()/@import, preconnect/dns-prefetch/
// preload/prefetch hints, favicons, OpenGraph images, and tracking pixels.
// Markdown is excluded (docs may link out). Navigation anchors (`href={...}`
// to a site) are NOT flagged — only asset-loading markup is.
//
// Usage: node scripts/check-no-external-assets.mjs [dir ...]
//   Default dirs: apps, packages. Extra dirs support the guardrail's fixtures.
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const PATTERNS = [
  // Remote font services.
  "https://fonts.",
  "http://fonts.",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "//fonts.",
  // Common CDNs / analytics hosts.
  "cdn.",
  "cdnjs.cloudflare.com",
  "cdn.jsdelivr.net",
  "jsdelivr.net",
  "unpkg.com",
  "ajax.googleapis.com",
  "gstatic.com",
  "googletagmanager.com",
  "google-analytics.com",
  // Remote scripts / images / stylesheets (quote-shaped, so prose is safe).
  '<script src="http',
  "<script src='http",
  '<script src="//',
  "<script src='//",
  '<img src="http',
  "<img src='http",
  '<img src="//',
  "<img src='//",
  '<source src="http',
  '<video src="http',
  '<audio src="http',
  '<iframe src="http',
  // CSS url()/@import.
  "url(http",
  "url('http",
  'url("http',
  "url(//",
  "url('//",
  'url("//',
  "@import url(http",
  '@import "http',
  "@import '//",
  // Connection hints (metadata-producing even before content is fetched).
  "rel=preconnect",
  'rel="preconnect"',
  "rel='preconnect'",
  "rel=dns-prefetch",
  'rel="dns-prefetch"',
  "rel='dns-prefetch'",
  'rel="prefetch"',
  "rel='prefetch'",
  '<link rel="preload" href="http',
  '<link rel="preload" href="//',
  '<link rel="prefetch" href="http',
  '<link rel="stylesheet" href="http',
  "<link rel='stylesheet' href='http",
  '<link rel="stylesheet" href="//',
  // Remote favicon / OpenGraph / Twitter card images.
  'rel="icon" href="http',
  'rel="shortcut icon" href="http',
  'property="og:image" content="http',
  'name="twitter:image" content="http',
  // Imperative remote image loads / tracking pixels.
  "new Image(",
  '.src = "http',
  ".src = 'http",
  '.src="http',
  ".src='http",
];

const DEFAULT_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".css", ".html", ".json", ".webmanifest"];

const args = process.argv.slice(2);
const scanDirs = args.length > 0 && !args[0].startsWith("--") ? args : DEFAULT_DIRS;

const root = repoRoot();
const violations = [];

for (const dir of scanDirs) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const pattern of PATTERNS) {
        if (line.includes(pattern)) {
          violations.push(
            `${repoRelative(root, file)}:${index + 1} — forbidden remote-asset pattern "${pattern}"`,
          );
        }
      }
    });
  }
}

report("check:no-external-assets", violations);
