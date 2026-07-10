// Network-client / analytics / AI dependency scanner (TECH-09).
//
// Scans every workspace package.json (root + apps/* + packages/*) for direct
// dependencies on network clients, analytics/telemetry SDKs, cloud AI SDKs, or
// the Tauri HTTP plugin. Fails hard — FreeLayer's default build must ship none.
// Transitive dependencies are not scanned here (dependency-review + pnpm audit
// cover the tree); this catches DIRECT adoption.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPathExisting, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

// Exact package names or scoped prefixes (matched on the dependency key).
const FORBIDDEN_DEPS = [
  "axios",
  "got",
  "ky",
  "superagent",
  "request",
  "node-fetch",
  "undici",
  "socket.io-client",
  "ws",
  "graphql-request",
  "@apollo/client",
  "firebase",
  "@supabase/supabase-js",
  "@sentry/", // prefix
  "posthog-js",
  "posthog-node",
  "mixpanel",
  "mixpanel-browser",
  "@segment/",
  "@amplitude/",
  "amplitude-js",
  "@datadog/",
  "dd-trace",
  "openai",
  "@anthropic-ai/",
  "@google-cloud/",
  "@tauri-apps/plugin-http",
  // Link-preview / OpenGraph / URL-unfurling / HTML-scraper packages (TECH-11).
  // These fetch and parse remote pages — exactly what the Metadata Firewall and
  // NetworkPolicy forbid. Adding one is a review-blocking event.
  "metascraper", // prefix — metascraper-* subpackages
  "open-graph-scraper",
  "link-preview-js",
  "url-metadata",
  "unfurl.js",
  "html-metadata",
  "@extractus/", // prefix — oembed/article/etc. extractors
  "cheerio",
];

function isForbidden(depName) {
  return FORBIDDEN_DEPS.some((f) => (f.endsWith("/") ? depName.startsWith(f) : depName === f));
}

const root = repoRoot();
const violations = [];

// Root package.json + every package.json under apps/ and packages/.
const manifests = ["package.json"];
for (const dir of ["apps", "packages"]) {
  for (const file of walkFiles(join(root, dir), ["package.json"])) {
    manifests.push(repoRelative(root, file));
  }
}

for (const manifest of manifests) {
  const abs = join(root, manifest);
  if (!isPathExisting(abs)) {
    continue;
  }
  let json;
  try {
    json = JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    violations.push(`${manifest} — could not parse package.json`);
    continue;
  }
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const deps = json[field];
    if (deps === undefined || deps === null) {
      continue;
    }
    for (const depName of Object.keys(deps)) {
      if (isForbidden(depName)) {
        violations.push(
          `${manifest} — forbidden network/analytics/AI dependency "${depName}" in ${field}`,
        );
      }
    }
  }
}

report("check:no-network-deps", violations);
