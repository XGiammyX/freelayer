/**
 * Security-regression: the forbidden-storage guardrail script actually
 * catches direct storage APIs (it guards the write barrier's perimeter).
 * The scanner runs against fixture directories passed explicitly; default
 * runs never scan tests/fixtures.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const SCRIPT = "scripts/check-no-forbidden-storage.mjs";

function runScanner(dir: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [SCRIPT, dir], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("check-no-forbidden-storage guardrail", () => {
  it("fails on direct browser-local storage usage", () => {
    const { status, output } = runScanner("tests/fixtures/forbidden-storage");
    expect(status).toBe(1);
    expect(output).toContain(["local", "Storage"].join(""));
  });

  it("fails on direct browser-database usage", () => {
    const { status, output } = runScanner("tests/fixtures/forbidden-storage");
    expect(status).toBe(1);
    expect(output).toContain(["indexed", "DB"].join(""));
  });

  it("fails on direct filesystem writes", () => {
    const { status, output } = runScanner("tests/fixtures/forbidden-storage");
    expect(status).toBe(1);
    expect(output).toContain("writeFileSync");
  });

  it("fails on page-cache usage", () => {
    const { status, output } = runScanner("tests/fixtures/forbidden-storage");
    expect(status).toBe(1);
    expect(output).toContain("caches.open");
  });

  it("passes a clean directory", () => {
    const { status, output } = runScanner("tests/fixtures/clean");
    expect(status).toBe(0);
    expect(output).toContain("OK");
  });

  it("does not fail on markdown mentions of forbidden APIs", () => {
    const { status, output } = runScanner("tests/fixtures/clean-md");
    expect(status).toBe(0);
    expect(output).toContain("OK");
  });
});
