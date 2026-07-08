// External-asset guard (ADR-0008, docs/NO_EXTERNAL_ASSETS_POLICY.md).
//
// Fails on obvious remote-asset patterns in app/package SOURCE files.
// Markdown is deliberately excluded: documentation may legitimately link to
// external pages. This is a baseline pattern scan; a CSP check and a runtime
// egress test are tracked at Gates A/D.
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const PATTERNS = [
  "https://fonts.",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.",
  '<script src="http',
  '<img src="http',
  "url(http",
  "@import url(http",
];

const SCAN_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".css", ".html", ".json"];

const root = repoRoot();
const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      for (const pattern of PATTERNS) {
        if (line.includes(pattern)) {
          violations.push(
            `${repoRelative(root, file)}:${index + 1} — forbidden external-asset pattern "${pattern}"`,
          );
        }
      }
    });
  }
}

report("check:no-external-assets", violations);
