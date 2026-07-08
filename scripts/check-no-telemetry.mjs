// Telemetry/analytics guard (ADR-0008 — no telemetry, ever, by default).
//
// Fails on known telemetry/analytics SDK names in workspace manifests and
// source files. The name list is a starting point, not an exhaustive control;
// dependency review (docs/DEPENDENCY_POLICY.md) remains the human backstop.
import { join } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const FORBIDDEN = [
  "google-analytics",
  "googletagmanager",
  "gtag(",
  '"gtag"',
  "plausible",
  "posthog",
  "@sentry/",
  '"sentry"',
  "segment.com",
  "@segment/",
  "mixpanel",
  "amplitude",
  "@datadog/",
  "newrelic",
  "logrocket",
  "hotjar",
  "fullstory",
];

const SCAN_DIRS = ["apps", "packages"];
const EXTS = [".ts", ".tsx", ".json", ".html", ".css", ".mjs"];

const root = repoRoot();
const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walkFiles(join(root, dir), EXTS)) {
    const lines = fileLines(file);
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      for (const name of FORBIDDEN) {
        if (lower.includes(name)) {
          violations.push(
            `${repoRelative(root, file)}:${index + 1} — telemetry/analytics indicator "${name}"`,
          );
        }
      }
    });
  }
}

report("check:no-telemetry", violations);
