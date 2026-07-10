/**
 * Privacy-regression (TECH-10): MetadataPolicy does not live in isolation.
 * These tests import all three policy engines and assert they AGREE — the
 * cross-package coordination that the boundary rules forbid expressing in code
 * (privacy may not import storage/transports) is proven here instead.
 */
import { describe, expect, it } from "vitest";
import { resolveMetadataPolicy } from "@freelayer/privacy";
import { resolveNetworkPolicy } from "@freelayer/transports";
import { resolveStoragePolicy } from "@freelayer/storage";

describe("MetadataPolicy ↔ NetworkPolicy agreement", () => {
  it("both deny automatic link preview (test 30)", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      const meta = resolveMetadataPolicy({ mode, event: "link.preview", sink: "network" });
      const net = resolveNetworkPolicy({
        mode,
        operation: "link.preview",
        transportClass: "relay",
      });
      expect(meta.allowed, `meta/${mode}`).toBe(false);
      expect(net.allowed, `net/${mode}`).toBe(false);
    }
  });

  it("both deny external asset fetch", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      const meta = resolveMetadataPolicy({ mode, event: "asset.remote_fetch", sink: "network" });
      const net = resolveNetworkPolicy({ mode, operation: "asset.fetch", transportClass: "relay" });
      expect(meta.allowed, `meta/${mode}`).toBe(false);
      expect(net.allowed, `net/${mode}`).toBe(false);
    }
  });

  it("both deny WebRTC candidate exposure", () => {
    const meta = resolveMetadataPolicy({
      mode: "private",
      event: "webrtc.ice_candidate",
      sink: "network",
    });
    const net = resolveNetworkPolicy({
      mode: "private",
      operation: "network.connect",
      transportClass: "webrtc",
    });
    expect(meta.allowed).toBe(false);
    expect(net.allowed).toBe(false);
  });

  it("both deny telemetry-shaped exposure", () => {
    const meta = resolveMetadataPolicy({
      mode: "standard",
      event: "transport.send_timing",
      sink: "network",
    });
    const net = resolveNetworkPolicy({
      mode: "standard",
      operation: "telemetry.send",
      transportClass: "relay",
    });
    expect(meta.allowed).toBe(false);
    expect(net.allowed).toBe(false);
  });
});

describe("MetadataPolicy ↔ StoragePolicy agreement", () => {
  it("both deny preview/thumbnail caches in Private+ (test 31)", () => {
    for (const mode of ["private", "ghost", "bunker"] as const) {
      const store = resolveStoragePolicy({
        mode,
        dataClass: "preview_cache",
        sensitivity: "metadata",
      });
      const meta = resolveMetadataPolicy({ mode, event: "preview.generated", sink: "cache" });
      expect(store.allowWrite, `store/${mode}`).toBe(false);
      expect(meta.allowed, `meta/${mode}`).toBe(false);
    }
  });

  it("both deny protected reveal-state persistence in Bunker", () => {
    const store = resolveStoragePolicy({
      mode: "bunker",
      dataClass: "protected_content_reveal_state",
      sensitivity: "sensitive_metadata",
    });
    const meta = resolveMetadataPolicy({
      mode: "bunker",
      event: "protected_content.revealed",
      sink: "local_persistent_storage",
    });
    expect(store.allowWrite).toBe(false);
    expect(meta.allowed).toBe(false);
  });

  it("both deny AI caches everywhere in v0", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      const store = resolveStoragePolicy({
        mode,
        dataClass: "ai_output_cache",
        sensitivity: "metadata",
      });
      const meta = resolveMetadataPolicy({ mode, event: "ai.cache_exists", sink: "ai" });
      expect(store.allowWrite, `store/${mode}`).toBe(false);
      expect(meta.allowed, `meta/${mode}`).toBe(false);
    }
  });

  it("both deny audit/metadata persistence in Ghost/Bunker", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const meta = resolveMetadataPolicy({
        mode,
        event: "audit_event.write",
        sink: "local_persistent_storage",
      });
      expect(meta.allowed, `meta/${mode}`).toBe(false);
      expect(meta.persistentAllowed, `meta/${mode}`).toBe(false);
    }
  });
});

describe("ScreenShield metadata hooks (placeholder alignment)", () => {
  it("sealed ScreenShield denies protected reveal metadata even in Standard", () => {
    const meta = resolveMetadataPolicy({
      mode: "standard",
      event: "protected_content.revealed",
      sink: "local_memory",
      screenShieldLevel: "sealed",
    });
    expect(meta.allowed).toBe(false);
  });

  it("endpoint signals never persist and never egress", () => {
    const meta = resolveMetadataPolicy({
      mode: "standard",
      event: "screen.capture_detected",
      sink: "audit",
    });
    expect(meta.persistentAllowed).toBe(false);
    expect(meta.networkAllowed).toBe(false);
  });
});
