// Remote-asset guard (ADR-0008, docs/NO_EXTERNAL_ASSETS_POLICY.md).
// Improved in TECH-09 into a fuller remote-asset scanner.
//
// Fails on remote-asset patterns in app/package SOURCE files: remote images,
// fonts, stylesheets, scripts, preconnect/dns-prefetch/preload hints, and
// tracking-pixel-shaped requests. Markdown is excluded (docs may link out).
// Navigation anchors (`href={...}` to github.com) are NOT flagged — only
// asset-loading markup is (src=, url(), @import, remote stylesheet/font/script).
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const PATTERNS = [
  "https://fonts.",
  "http://fonts.",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "//fonts.",
  "cdn.",
  '<script src="http',
  "<script src='http",
  '<img src="http',
  "<img src='http",
  "url(http",
  "url('http",
  'url("http',
  "@import url(http",
  '@import "http',
  "rel=preconnect",
  'rel="preconnect"',
  "rel='preconnect'",
  "dns-prefetch",
  '<link rel="preload" href="http',
  '<link rel="stylesheet" href="http',
  "<link rel='stylesheet' href='http",
  'rel="icon" href="http', // remote favicon
];

const SCAN_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".css", ".html", ".json", ".webmanifest"];

const root = repoRoot();
const violations = [];

for (const dir of SCAN_DIRS) {
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
