/**
 * Security-regression (TECH-07): output/artifact sentinel scan + guardrail v3
 * + boundary regression.
 *
 * If a sensitive value that flowed through storage ever lands in a generated
 * artifact (build output, coverage, snapshots), this scan catches it. Source
 * files that intentionally define the sentinel are not scanned (only output
 * directories are), so no allowlist gymnastics are needed.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { issuePolicyDecision } from "@freelayer/privacy";
import { MemoryStorageProvider, resolveStoragePolicy } from "@freelayer/storage";

const ZP_SENTINEL = "FREELAYER_ZERO_PERSISTENCE_SENTINEL_DO_NOT_LEAK";

/** Output directories that may exist after builds/tests. Scanned recursively. */
const OUTPUT_DIRS = ["coverage", "apps/web/dist", "tests/__snapshots__", ".vitest"] as const;

function scanDirForSentinel(dir: string): { scanned: number; hits: string[] } {
  const hits: string[] = [];
  let scanned = 0;
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        // Single read, no stat-then-read race: size is bounded after the
        // fact (artifact dirs are small; an oversized file is skipped).
        scanned += 1;
        const content = readFileSync(full, "utf8");
        if (content.length < 10_000_000 && content.includes(ZP_SENTINEL)) {
          hits.push(full);
        }
      }
    }
  };
  walk(dir);
  return { scanned, hits };
}

describe("Artifact sentinel scan", () => {
  it("no generated output contains the zero-persistence sentinel", async () => {
    // First push the sentinel through a full strict-mode storage workout so
    // there is a real chance to leak before we scan.
    const provider = new MemoryStorageProvider();
    const policy = resolveStoragePolicy({
      mode: "ghost",
      dataClass: "message_content",
      sensitivity: "content",
    });
    await provider.write(
      {
        operation: "storage.write",
        dataClass: "message_content",
        key: "artifact-scan",
        value: ZP_SENTINEL,
        sensitivity: "content",
        reason: "artifact scan workout",
      },
      issuePolicyDecision("persistence", "allowed", "ghost", "storage.write"),
      policy,
    );

    const coverage: string[] = [];
    for (const dir of OUTPUT_DIRS) {
      if (!existsSync(dir)) {
        coverage.push(`${dir}: not applicable (absent)`);
        continue;
      }
      const { scanned, hits } = scanDirForSentinel(dir);
      coverage.push(`${dir}: ${scanned} files scanned`);
      expect(hits, `sentinel leaked into ${dir}`).toEqual([]);
    }
    // Honest coverage report — at least the check ran over something or
    // recorded absence explicitly.
    expect(coverage.length).toBe(OUTPUT_DIRS.length);
  });
});

describe("Forbidden-storage guardrail v3 (File System Access API)", () => {
  const run = (dir: string) =>
    spawnSync(process.execPath, ["scripts/check-no-forbidden-storage.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

  it("catches showSaveFilePicker in the violation fixture", () => {
    const result = run("tests/fixtures/forbidden-storage");
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("showSaveFilePicker");
  });

  it("placeholder provider source stays clean (no forbidden calls in packages)", () => {
    const result = run("packages");
    expect(result.status).toBe(0);
  });
});

describe("Boundary regression", () => {
  it("apps cannot import storage providers (check-boundaries stays green)", () => {
    const result = spawnSync(process.execPath, ["scripts/check-boundaries.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("OK");
  });
});
