// Publishes the contents of wiki/ to the GitHub wiki repository.
//
// GitHub limitation: the <repo>.wiki.git repository does not exist until the
// FIRST wiki page is created once through the web UI (there is no API for
// this). One-time bootstrap:
//   1. Open https://github.com/XGiammyX/freelayer/wiki
//   2. Click "Create the first page" and save it with any content.
//   3. Run: node scripts/publish-wiki.mjs
// Every run afterwards syncs wiki/*.md to the wiki (wiki/ in this repo is
// the reviewed source of truth for wiki content).
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WIKI_URL = "https://github.com/XGiammyX/freelayer.wiki.git";
const SOURCE = join(process.cwd(), "wiki");

const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: "pipe" }).toString();

// README.md documents the wiki/ directory itself and is not a wiki page.
const pages = readdirSync(SOURCE).filter((f) => f.endsWith(".md") && f !== "README.md");
if (pages.length === 0) {
  console.error("[publish-wiki] wiki/ contains no pages — nothing to publish.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "freelayer-wiki-"));
try {
  try {
    git(["clone", "--depth", "1", WIKI_URL, work]);
  } catch {
    console.error(
      "[publish-wiki] Could not clone the wiki repository. It likely has no pages yet.\n" +
        "One-time bootstrap: open https://github.com/XGiammyX/freelayer/wiki , create the\n" +
        "first page via the UI, then re-run this script.",
    );
    process.exit(1);
  }
  for (const page of pages) {
    cpSync(join(SOURCE, page), join(work, page));
  }
  git(["add", "."], work);
  const status = git(["status", "--porcelain"], work);
  if (status.trim() === "") {
    console.log("[publish-wiki] Wiki already up to date.");
    process.exit(0);
  }
  git(["commit", "-m", "wiki: sync from repository wiki/ directory"], work);
  git(["push"], work);
  console.log(`[publish-wiki] Published ${pages.length} pages to the wiki.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
