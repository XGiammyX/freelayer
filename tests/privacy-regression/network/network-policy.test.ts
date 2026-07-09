/**
 * Privacy-regression (TECH-08): NetworkPolicy matrix — default deny,
 * mode-specific denials, strictest-wins room composition, metadata labels.
 */
import { describe, expect, it } from "vitest";
import {
  describeNetworkMetadataLeakage,
  NETWORK_OPERATION_KINDS,
  resolveNetworkPolicy,
  type NetworkOperationKind,
  type TransportClass,
} from "@freelayer/transports";
import type { PrivacyMode } from "@freelayer/privacy";

const ALL_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

describe("Always-forbidden operations (every mode)", () => {
  const alwaysForbidden: readonly NetworkOperationKind[] = [
    "telemetry.send",
    "asset.fetch",
    "link.preview",
    "ai.remote_request",
    "update.check",
  ];
  for (const operation of alwaysForbidden) {
    it(`${operation} denied in all modes`, () => {
      for (const mode of ALL_MODES) {
        const policy = resolveNetworkPolicy({ mode, operation, transportClass: "relay" });
        expect(policy.allowed, `${mode}/${operation}`).toBe(false);
      }
    });
  }

  it("telemetry / external assets / link previews are never allowed by any policy", () => {
    const policy = resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.send",
      transportClass: "relay",
    });
    expect(policy.allowsTelemetry).toBe(false);
    expect(policy.allowsExternalAssets).toBe(false);
    expect(policy.allowsAutomaticLinkPreview).toBe(false);
  });
});

describe("Offline Capsule and Emergency deny network", () => {
  for (const mode of ["offline_capsule", "emergency"] as const) {
    it(`${mode} denies networked operations`, () => {
      for (const operation of ["transport.send", "transport.poll", "network.request"] as const) {
        const policy = resolveNetworkPolicy({ mode, operation, transportClass: "relay" });
        expect(policy.allowed, `${mode}/${operation}`).toBe(false);
      }
    });
  }
});

describe("WebRTC / direct peer connections", () => {
  it("denied in Standard, Private, Ghost, Bunker", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      const policy = resolveNetworkPolicy({
        mode,
        operation: "network.connect",
        transportClass: "webrtc",
      });
      expect(policy.allowed, mode).toBe(false);
      expect(policy.allowsDirectPeerConnection, mode).toBe(false);
    }
  });
});

describe("Ghost / Bunker deny direct network", () => {
  for (const mode of ["ghost", "bunker"] as const) {
    it(`${mode} denies relay/http/websocket/lan operations`, () => {
      for (const transportClass of ["relay", "http", "websocket", "lan"] as const) {
        const policy = resolveNetworkPolicy({
          mode,
          operation: "transport.send",
          transportClass,
        });
        expect(policy.allowed, `${mode}/${transportClass}`).toBe(false);
      }
    });
  }
});

describe("Standard / Private user-initiated placeholders", () => {
  it("relay send in Standard is an allowed placeholder requiring user initiation", () => {
    const policy = resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.send",
      transportClass: "relay",
    });
    expect(policy.allowed).toBe(true);
    expect(policy.capability).toBe("allowed_placeholder");
    expect(policy.requiresUserInitiation).toBe(true);
  });

  it("Private denies LAN discovery by default", () => {
    const policy = resolveNetworkPolicy({
      mode: "private",
      operation: "transport.discovery",
      transportClass: "lan",
    });
    expect(policy.allowed).toBe(false);
  });

  it("HTTP and WebSocket forbidden in Standard/Private", () => {
    for (const mode of ["standard", "private"] as const) {
      for (const transportClass of ["http", "websocket"] as const) {
        expect(
          resolveNetworkPolicy({ mode, operation: "network.request", transportClass }).allowed,
        ).toBe(false);
      }
    }
  });
});

describe("Offline transports are not network operations", () => {
  it("QR/file/USB are offline_only, not egress", () => {
    for (const transportClass of ["qr", "file", "usb"] as const) {
      const policy = resolveNetworkPolicy({
        mode: "standard",
        operation: "transport.send",
        transportClass,
      });
      expect(policy.capability).toBe("offline_only");
      const label = describeNetworkMetadataLeakage({ transportClass, operation: "transport.send" });
      expect(label.exposesIpAddress).toBe(false);
    }
  });
});

describe("Fail closed", () => {
  it("unknown operation, transport, and mode all deny", () => {
    expect(
      resolveNetworkPolicy({
        mode: "standard",
        operation: "network.teleport" as NetworkOperationKind,
        transportClass: "relay",
      }).allowed,
    ).toBe(false);
    expect(
      resolveNetworkPolicy({
        mode: "standard",
        operation: "transport.send",
        transportClass: "carrier_pigeon" as TransportClass,
      }).allowed,
    ).toBe(false);
    expect(
      resolveNetworkPolicy({
        mode: "party" as PrivacyMode,
        operation: "transport.send",
        transportClass: "relay",
      }).allowed,
    ).toBe(false);
  });
});

describe("Sovereign Room composition (strictest wins)", () => {
  it("room cannot loosen a Bunker device", () => {
    const policy = resolveNetworkPolicy({
      mode: "bunker",
      operation: "transport.send",
      transportClass: "relay",
      roomPolicy: { allowed: true, allowsDirectPeerConnection: true },
    });
    expect(policy.allowed).toBe(false);
  });

  it("room allowing WebRTC on a Private device is still denied", () => {
    const policy = resolveNetworkPolicy({
      mode: "private",
      operation: "network.connect",
      transportClass: "webrtc",
      roomPolicy: { allowed: true, allowsDirectPeerConnection: true },
    });
    expect(policy.allowed).toBe(false);
  });

  it("room can tighten an allowed placeholder", () => {
    const policy = resolveNetworkPolicy({
      mode: "standard",
      operation: "transport.send",
      transportClass: "relay",
      roomPolicy: { allowed: false },
    });
    expect(policy.allowed).toBe(false);
  });
});

describe("Metadata leakage labels", () => {
  it("assigns honest exposure levels per transport", () => {
    expect(
      describeNetworkMetadataLeakage({ transportClass: "webrtc", operation: "network.connect" })
        .exposureLevel,
    ).toBe("high");
    expect(
      describeNetworkMetadataLeakage({ transportClass: "email", operation: "transport.send" })
        .exposureLevel,
    ).toBe("high");
    expect(
      describeNetworkMetadataLeakage({ transportClass: "relay", operation: "transport.poll" })
        .exposureLevel,
    ).toBe("medium");
    expect(
      describeNetworkMetadataLeakage({ transportClass: "qr", operation: "transport.send" })
        .exposureLevel,
    ).toBe("local_only");
    expect(
      describeNetworkMetadataLeakage({ transportClass: "unknown", operation: "transport.send" })
        .exposureLevel,
    ).toBe("unknown");
  });

  it("every operation kind resolves to a policy without throwing", () => {
    for (const operation of NETWORK_OPERATION_KINDS) {
      const policy = resolveNetworkPolicy({ mode: "standard", operation, transportClass: "relay" });
      expect(policy.operation).toBe(operation);
    }
  });
});
