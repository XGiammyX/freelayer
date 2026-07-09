/**
 * Security-regression (TECH-08): network barrier, endpoint redaction, runtime
 * network trap, and forbidden-network guardrail.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { issuePolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import {
  assertNetworkOperationAllowed,
  createMockNetworkTransport,
  createNoopTransport,
  ForbiddenDirectPeerConnectionError,
  ForbiddenTelemetryError,
  InvalidNetworkEndpointError,
  NetworkBypassAttemptError,
  NetworkDecisionMismatchError,
  NetworkPolicyDeniedError,
  resolveNetworkPolicy,
  validateNetworkEndpoint,
  type NetworkRequest,
} from "@freelayer/transports";
import {
  createNetworkSideEffectTrap,
  NetworkSideEffectTrapError,
  type NetworkSideEffectTrap,
} from "../../helpers/network-trap";

const NET_SENTINEL = "FREELAYER_NETWORK_SENTINEL_DO_NOT_LEAK";

const sendReq = (over: Partial<NetworkRequest> = {}): NetworkRequest => ({
  operation: "transport.send",
  transportClass: "relay",
  userInitiated: true,
  reason: "tech-08 test",
  metadataSensitivity: "relationship_metadata",
  ...over,
});

const decisionFor = (op: NetworkRequest["operation"], verdict: "allowed" | "denied" = "allowed") =>
  issuePolicyDecision("network", verdict, "standard", op);

const standardRelayPolicy = () =>
  resolveNetworkPolicy({ mode: "standard", operation: "transport.send", transportClass: "relay" });

describe("Network barrier — decision requirements", () => {
  it("rejects a forged decision", () => {
    const forged = { verdict: "allowed" } as unknown as PolicyDecision;
    expect(() => assertNetworkOperationAllowed(sendReq(), forged, standardRelayPolicy())).toThrow(
      NetworkBypassAttemptError,
    );
  });

  it("rejects a denied decision", () => {
    expect(() =>
      assertNetworkOperationAllowed(
        sendReq(),
        decisionFor("transport.send", "denied"),
        standardRelayPolicy(),
      ),
    ).toThrow(NetworkPolicyDeniedError);
  });

  it("rejects a decision scoped to a different operation", () => {
    const wrongScope = issuePolicyDecision("network", "allowed", "standard", "transport.poll");
    expect(() =>
      assertNetworkOperationAllowed(sendReq(), wrongScope, standardRelayPolicy()),
    ).toThrow(NetworkDecisionMismatchError);
  });

  it("rejects a non-network capability", () => {
    const wrongCap = issuePolicyDecision("persistence", "allowed", "standard", "transport.send");
    expect(() => assertNetworkOperationAllowed(sendReq(), wrongCap, standardRelayPolicy())).toThrow(
      NetworkDecisionMismatchError,
    );
  });

  it("requires user initiation when policy demands it", () => {
    expect(() =>
      assertNetworkOperationAllowed(
        sendReq({ userInitiated: false }),
        decisionFor("transport.send"),
        standardRelayPolicy(),
      ),
    ).toThrow(NetworkPolicyDeniedError);
  });
});

describe("Network barrier — category denials", () => {
  it("telemetry always denied with the specific error", () => {
    const policy = resolveNetworkPolicy({
      mode: "standard",
      operation: "telemetry.send",
      transportClass: "relay",
    });
    expect(() =>
      assertNetworkOperationAllowed(
        sendReq({ operation: "telemetry.send", metadataSensitivity: "critical" }),
        issuePolicyDecision("network", "allowed", "standard", "telemetry.send"),
        policy,
      ),
    ).toThrow(ForbiddenTelemetryError);
  });

  it("direct peer connection denied under Private", () => {
    const policy = resolveNetworkPolicy({
      mode: "private",
      operation: "network.connect",
      transportClass: "webrtc",
    });
    expect(() =>
      assertNetworkOperationAllowed(
        sendReq({ operation: "network.connect", transportClass: "webrtc" }),
        issuePolicyDecision("directTransport", "allowed", "private", "network.connect"),
        policy,
      ),
    ).toThrow(ForbiddenDirectPeerConnectionError);
  });
});

describe("Endpoint validation and redaction", () => {
  it("rejects insecure, credentialed, private, sentinel and suspicious endpoints without echoing them", () => {
    const bad = [
      "",
      `${"http"}://example.com`,
      "https://user:pass@example.com",
      "https://localhost/x",
      "https://192.168.1.1/x",
      "file:///etc/passwd",
      "https://example.com/?token=abc",
      `https://example.com/${NET_SENTINEL}`,
      "ftp://example.com",
    ];
    for (const endpoint of bad) {
      let msg = "";
      try {
        validateNetworkEndpoint(endpoint);
        throw new Error(`expected rejection for ${endpoint}`);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(InvalidNetworkEndpointError);
        msg = (error as Error).message;
      }
      expect(msg).toBe("Invalid network endpoint.");
      expect(msg).not.toContain(NET_SENTINEL);
    }
  });

  it("accepts a plain https endpoint (still not enough to allow without policy)", () => {
    expect(validateNetworkEndpoint("https://relay.example.org/pickup")).toBe(
      "https://relay.example.org/pickup",
    );
  });

  it("barrier rejects an endpoint when policy forbids external endpoints, error stays redacted", () => {
    const policy = resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.poll",
      transportClass: "lan",
    });
    let msg = "";
    try {
      assertNetworkOperationAllowed(
        sendReq({
          operation: "transport.poll",
          transportClass: "lan",
          endpoint: `https://x/${NET_SENTINEL}`,
        }),
        issuePolicyDecision("network", "allowed", "standard", "transport.poll"),
        policy,
      );
      throw new Error("expected rejection");
    } catch (error: unknown) {
      msg = (error as Error).message;
    }
    expect(msg).not.toContain(NET_SENTINEL);
  });
});

describe("Runtime network trap — providers touch no network API", () => {
  let trap: NetworkSideEffectTrap;
  beforeEach(() => {
    trap = createNetworkSideEffectTrap();
  });
  afterEach(() => {
    trap.uninstall();
  });

  it("resolveNetworkPolicy calls no network API", () => {
    resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.send",
      transportClass: "relay",
    });
    trap.assertNoNetworkApiCalled();
  });

  it("NoopTransport performs no network I/O for an allowed op", async () => {
    const transport = createNoopTransport();
    await transport.send(sendReq(), decisionFor("transport.send"), standardRelayPolicy());
    expect(transport.performsRealNetwork).toBe(false);
    trap.assertNoNetworkApiCalled();
  });

  it("MockNetworkTransport records in memory only, no network API", async () => {
    const transport = createMockNetworkTransport();
    await transport.send(sendReq(), decisionFor("transport.send"), standardRelayPolicy());
    const received = await transport.receive(
      sendReq({ operation: "transport.receive" }),
      issuePolicyDecision("network", "allowed", "standard", "transport.receive"),
      resolveNetworkPolicy({
        mode: "standard",
        operation: "transport.receive",
        transportClass: "relay",
      }),
    );
    expect(received.length).toBe(1);
    trap.assertNoNetworkApiCalled();
  });

  it("denied operations fail before any network API is reached", async () => {
    const transport = createNoopTransport();
    const bunkerPolicy = resolveNetworkPolicy({
      mode: "bunker",
      operation: "transport.send",
      transportClass: "relay",
    });
    await expect(
      transport.send(
        sendReq(),
        issuePolicyDecision("network", "allowed", "bunker", "transport.send"),
        bunkerPolicy,
      ),
    ).rejects.toThrow(NetworkPolicyDeniedError);
    trap.assertNoNetworkApiCalled();
  });

  it("positive control: the trap actually catches a fetch attempt", () => {
    expect(() => (globalThis as { fetch: (u: string) => unknown }).fetch("https://x")).toThrow(
      NetworkSideEffectTrapError,
    );
    expect(trap.calls).toContain("fetch");
  });

  it("positive control: the trap catches WebSocket/RTCPeerConnection construction", () => {
    const G = globalThis as unknown as Record<string, new (...a: unknown[]) => unknown>;
    const WS = G["WebSocket"];
    const RTC = G["RTCPeerConnection"];
    expect(WS).toBeDefined();
    expect(RTC).toBeDefined();
    expect(() => new WS!("wss://x")).toThrow(NetworkSideEffectTrapError);
    expect(() => new RTC!()).toThrow(NetworkSideEffectTrapError);
  });
});

describe("Forbidden-network guardrail", () => {
  const run = (dir: string) =>
    spawnSync(process.execPath, ["scripts/check-no-forbidden-network.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

  it("catches fetch/WebSocket/RTCPeerConnection/sendBeacon in the fixture", () => {
    const result = run("tests/fixtures/forbidden-network");
    expect(result.status).toBe(1);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain("fetch(");
    expect(out).toContain("new WebSocket");
    expect(out).toContain("new RTCPeerConnection");
    expect(out).toContain("navigator.sendBeacon");
  });

  it("catches the Tauri HTTP plugin import", () => {
    const result = run("tests/fixtures/forbidden-network");
    expect(`${result.stdout}${result.stderr}`).toContain("@tauri-apps/plugin-http");
  });

  it("packages source stays clean (no forbidden network APIs)", () => {
    const result = run("packages");
    expect(result.status).toBe(0);
  });

  it("does not fail on markdown mentions of fetch", () => {
    const result = run("tests/fixtures/clean-md");
    expect(result.status).toBe(0);
  });
});
