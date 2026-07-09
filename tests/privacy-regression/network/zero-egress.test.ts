/**
 * Privacy-regression (TECH-09): zero-egress default build.
 *
 * Verifies FreeLayer's runtime load path calls no network API, the built app
 * has no remote hosts outside the allowlist, the scanners catch violations in
 * fixtures, and no network-client dependency is present.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createFreeLayerClient } from "@freelayer/sdk";
import {
  createMockNetworkTransport,
  createNoopTransport,
  resolveNetworkPolicy,
  type NetworkRequest,
} from "@freelayer/transports";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  createZeroEgressRuntimeTrap,
  ZeroEgressTrapError,
  type ZeroEgressTrap,
} from "../../helpers/zero-egress-trap";

const ZE_SENTINEL = "FREELAYER_ZERO_EGRESS_SENTINEL_DO_NOT_CALL";
const FAKE_ENDPOINT = "https://freelayer.invalid/should-never-be-called";

let trap: ZeroEgressTrap;
beforeEach(() => {
  trap = createZeroEgressRuntimeTrap();
});
afterEach(() => {
  trap.uninstall();
});

const sendReq = (over: Partial<NetworkRequest> = {}): NetworkRequest => ({
  operation: "transport.send",
  transportClass: "relay",
  userInitiated: true,
  reason: "zero-egress test",
  metadataSensitivity: "relationship_metadata",
  ...over,
});

describe("Runtime load path performs no egress", () => {
  it("SDK client creation + status describe calls no network API", () => {
    const client = createFreeLayerClient();
    const status = client.describeStatus();
    expect(status.networking).toBe("none");
    trap.assertNoEgress();
  });

  it("NetworkPolicy resolution calls no network API", () => {
    resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.send",
      transportClass: "relay",
    });
    resolveNetworkPolicy({
      mode: "bunker",
      operation: "network.connect",
      transportClass: "webrtc",
    });
    trap.assertNoEgress();
  });

  it("Noop/Mock transports call no network API", async () => {
    const policy = resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.send",
      transportClass: "relay",
    });
    const decision = issuePolicyDecision("network", "allowed", "standard", "transport.send");
    await createNoopTransport().send(sendReq(), decision, policy);
    await createMockNetworkTransport().send(sendReq(), decision, policy);
    expect(createNoopTransport().performsRealNetwork).toBe(false);
    trap.assertNoEgress();
  });

  it("a denied operation calls no network API before throwing", async () => {
    const policy = resolveNetworkPolicy({
      mode: "bunker",
      operation: "transport.send",
      transportClass: "relay",
    });
    const decision = issuePolicyDecision("network", "allowed", "bunker", "transport.send");
    await expect(createNoopTransport().send(sendReq(), decision, policy)).rejects.toThrow();
    trap.assertNoEgress();
  });

  it("the fake sentinel endpoint is never called (and if it were, the trap fires)", () => {
    // We never call it. Positive control proves the trap would catch it.
    expect(() => (globalThis as { fetch: (u: string) => unknown }).fetch(FAKE_ENDPOINT)).toThrow(
      ZeroEgressTrapError,
    );
    expect(trap.calls).toContain("fetch");
  });
});

describe("Zero-egress trap coverage", () => {
  it("traps the core egress APIs and reports absent ones honestly", () => {
    expect(trap.coverage.trapped.length).toBeGreaterThanOrEqual(6);
    // WebSocket/RTCPeerConnection may be absent in node and get synthetic traps.
    const all = [...trap.coverage.trapped, ...trap.coverage.absent].join(",");
    expect(all).toContain("WebSocket");
    expect(all).toContain("RTCPeerConnection");
    expect(all).toContain("navigator.serviceWorker.register");
  });

  it("catches WebSocket / RTCPeerConnection / Image construction", () => {
    const G = globalThis as unknown as Record<string, new (...a: unknown[]) => unknown>;
    expect(() => new G["WebSocket"]!("wss://x")).toThrow(ZeroEgressTrapError);
    expect(() => new G["RTCPeerConnection"]!()).toThrow(ZeroEgressTrapError);
    expect(() => new G["Image"]!()).toThrow(ZeroEgressTrapError);
  });
});

describe("Build/scanner enforcement (spawned)", () => {
  const run = (script: string, args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { cwd: process.cwd(), encoding: "utf8" });

  it("build zero-egress scanner catches a bad build fixture", () => {
    const r = run("scripts/check-build-zero-egress.mjs", ["tests/fixtures/zero-egress/bad-build"]);
    expect(r.status).toBe(1);
    const out = `${r.stdout}${r.stderr}`;
    expect(out).toContain("fonts.googleapis.com");
    expect(out).toContain("googletagmanager");
    expect(out).toContain("freelayer.invalid");
  });

  it("the real web build (if present) has no egress violations", () => {
    if (!existsSync("apps/web/dist")) {
      // Not applicable without a build; CI builds before running this.
      expect(true).toBe(true);
      return;
    }
    const r = run("scripts/check-build-zero-egress.mjs", ["apps/web/dist"]);
    expect(r.status).toBe(0);
  });

  it("no network-client / analytics / AI dependency is present", () => {
    const r = run("scripts/check-no-network-deps.mjs", []);
    expect(r.status).toBe(0);
  });

  it("the sentinel does not appear in the real web build", () => {
    if (!existsSync("apps/web/dist")) {
      expect(true).toBe(true);
      return;
    }
    const r = run("scripts/check-build-zero-egress.mjs", ["apps/web/dist"]);
    expect(`${r.stdout}${r.stderr}`).not.toContain(ZE_SENTINEL);
  });
});
