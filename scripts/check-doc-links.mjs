// Documentation link checker: verifies that every RELATIVE markdown link in
// the repository resolves to an existing file. External links (http/https,
// mailto) and pure anchors are skipped — this guards repository integrity,
// not the internet. Fenced code blocks are ignored to avoid false positives.
//
// TODO (later): optionally validate #anchor fragments against headings.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileLines, report, repoRelative, repoRoot, walkFiles } from "./_util.mjs";

const SCAN_DIRS = ["docs", "apps", "packages", "tests", "."];
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const root = repoRoot();
const violations = [];
const seenFiles = new Set();

function filesToScan() {
  const out = [];
  for (const dir of SCAN_DIRS) {
    const base = resolve(root, dir);
    const files =
      dir === "."
        ? walkFiles(base, [".md"]).filter((f) => resolve(dirname(f)) === resolve(root))
        : walkFiles(base, [".md"]);
    for (const f of files) {
      const key = resolve(f);
      if (!seenFiles.has(key)) {
        seenFiles.add(key);
        out.push(f);
      }
    }
  }
  return out;
}

for (const file of filesToScan()) {
  const lines = fileLines(file);
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    for (const match of line.matchAll(LINK_RE)) {
      const target = match[1];
      if (
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("mailto:") ||
        target.startsWith("#")
      ) {
        continue;
      }
      const withoutAnchor = target.split("#")[0];
      if (withoutAnchor === "") {
        continue;
      }
      const resolved = join(dirname(file), decodeURI(withoutAnchor));
      // Directories are valid link targets — GitHub renders a file listing.
      if (!existsSync(resolved)) {
        violations.push(
          `${repoRelative(root, file)}:${index + 1} — broken relative link "${target}"`,
        );
      }
    }
  });
}

report("check:doc-links", violations);
