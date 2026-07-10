/**
 * Security-regression (TECH-11): URL classification and safe display never leak
 * credentials or query strings, classification/policy resolution perform NO
 * network calls, and the hardened external-asset scanner catches remote assets.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  classifyUrl,
  createRedactedAuditEvent,
  renderPlainTextUrlLabel,
  resolveExternalAssetPolicy,
  resolveLinkPreviewPolicy,
} from "@freelayer/privacy";

// A sentinel URL that must NEVER be fetched or leaked. Query carries the token.
const SENTINEL_URL = "https://freelayer.invalid/secret?token=FREELAYER_LINK_SENTINEL_DO_NOT_LEAK";
const SENTINEL = "FREELAYER_LINK_SENTINEL_DO_NOT_LEAK";

describe("URL classification and redaction", () => {
  it("redacts credentials (userinfo)", () => {
    const c = classifyUrl("https://alice:hunter2@example.com/inbox");
    expect(c.classification).toBe("https_url");
    expect(c.safeDisplayText).not.toContain("hunter2");
    expect(c.safeDisplayText).not.toContain("alice");
    expect(c.safeDisplayText).toBe("example.com/…");
  });

  it("redacts query strings and tokens", () => {
    const c = classifyUrl(SENTINEL_URL);
    expect(c.safeDisplayText).not.toContain(SENTINEL);
    expect(c.safeDisplayText).not.toContain("token");
    expect(c.safeDisplayText).toBe("freelayer.invalid/…");
  });

  it("redacts a password-bearing query", () => {
    const c = classifyUrl("http://example.com/login?password=s3cr3t");
    expect(c.safeDisplayText).not.toContain("s3cr3t");
    expect(c.safeDisplayText).not.toContain("password");
  });

  it("classifies dangerous schemes without executing/fetching them", () => {
    expect(classifyUrl("javascript:alert(1)").classification).toBe("javascript_url");
    expect(classifyUrl("file:///etc/passwd").classification).toBe("file_url");
    expect(classifyUrl("data:text/html;base64,PHNjcmlwdD4=").classification).toBe("data_url");
    expect(classifyUrl("blob:https://example.com/uuid").classification).toBe("blob_url");
    expect(classifyUrl("wss://example.com/socket").classification).toBe("websocket_url");
    expect(classifyUrl("javascript:alert(1)").networkCapable).toBe(false);
    expect(classifyUrl("wss://example.com/socket").networkCapable).toBe(true);
  });

  it("classifies relative/local vs external", () => {
    expect(classifyUrl("/docs/readme").classification).toBe("relative_url");
    expect(classifyUrl("#section").classification).toBe("local_fragment");
    expect(classifyUrl("https://example.com").external).toBe(true);
    expect(classifyUrl("/local").external).toBe(false);
  });

  it("renderPlainTextUrlLabel never emits credentials/query and honors sealed redaction", () => {
    expect(renderPlainTextUrlLabel(SENTINEL_URL)).toBe("freelayer.invalid/…");
    expect(renderPlainTextUrlLabel(SENTINEL_URL)).not.toContain(SENTINEL);
    expect(renderPlainTextUrlLabel(SENTINEL_URL, { forceRedactAll: true })).toBe("[redacted link]");
    expect(renderPlainTextUrlLabel("javascript:alert(1)")).toBe("[blocked script URL]");
  });
});

describe("Sentinel never leaks through errors/audit/policy reasons", () => {
  it("policy reasons never echo the raw URL/source", () => {
    const asset = resolveExternalAssetPolicy({
      mode: "standard",
      assetKind: "remote_image",
      source: SENTINEL_URL,
    });
    expect(asset.reason).not.toContain(SENTINEL);
    const link = resolveLinkPreviewPolicy({ mode: "standard" });
    expect(link.reason).not.toContain(SENTINEL);
  });

  it("redacted audit events drop the URL (string) entirely", () => {
    const event = createRedactedAuditEvent({
      kind: "link_preview_denied",
      category: "metadata",
      severity: "info",
      details: { url: SENTINEL_URL, classification: 1, denied: true },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(SENTINEL);
    expect(event.details).toEqual({ classification: 1, denied: true });
  });
});

describe("No network during classification or policy resolution", () => {
  it("does not call fetch", () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.reject(new Error("network forbidden in test"));
    }) as typeof globalThis.fetch;
    try {
      classifyUrl(SENTINEL_URL);
      renderPlainTextUrlLabel(SENTINEL_URL);
      resolveLinkPreviewPolicy({ mode: "standard" });
      resolveExternalAssetPolicy({ mode: "standard", assetKind: "remote_image" });
    } finally {
      globalThis.fetch = original;
    }
    expect(called).toBe(false);
  });
});

describe("Hardened external-asset scanner", () => {
  const SCRIPT = "scripts/check-no-external-assets.mjs";
  function runScanner(dir: string): { status: number | null; output: string } {
    const result = spawnSync(process.execPath, [SCRIPT, dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  }

  it("catches remote image/font/script/stylesheet/preconnect/dns-prefetch/preload/OpenGraph fixtures", () => {
    const { status, output } = runScanner("tests/fixtures/external-assets");
    expect(status).toBe(1);
    expect(output).toContain("cdnjs.cloudflare.com");
    expect(output).toContain("fonts.gstatic.com");
    expect(output).toContain('rel="preconnect"');
  });

  it("passes a local-only asset fixture", () => {
    const { status, output } = runScanner("tests/fixtures/external-assets-clean");
    expect(status).toBe(0);
    expect(output).toContain("OK");
  });

  it("finds no remote assets in the real app/package source", () => {
    const { status } = runScanner("packages");
    expect(status).toBe(0);
  });
});
