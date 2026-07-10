/**
 * Privacy-regression (TECH-13): Policy Matrix v1 — structure, fail-closed
 * evaluation, deny-overrides/strictest-wins composition, tighten-only room and
 * ScreenShield behavior, per-mode invariants, deferred gates, and AGREEMENT
 * with every concrete policy engine (Storage/Network/Metadata/LinkPreview/
 * ExternalAsset/Notification). The matrix is the oracle; drift is a bug.
 */
import { describe, expect, it } from "vitest";
import {
  applyStrictestPolicy,
  combinePolicyEffects,
  evaluatePolicyMatrix,
  isEffectStricterThan,
  MAJOR_POLICY_DOMAINS,
  POLICY_MATRIX_RULES,
  resolveExternalAssetPolicy,
  resolveLinkPreviewPolicy,
  resolveMetadataPolicy,
  resolveNotificationPolicy,
  type PolicyDomain,
  type PolicyMatrixDecision,
  type PrivacyMode,
} from "@freelayer/privacy";
import { resolveStoragePolicy } from "@freelayer/storage";
import { resolveNetworkPolicy } from "@freelayer/transports";

const ALL_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

function decide(domain: PolicyDomain, operation: string, mode: PrivacyMode) {
  return evaluatePolicyMatrix({ mode, domain, operation });
}

describe("Matrix structure (tests 1-3)", () => {
  it("has unique rule ids", () => {
    const ids = POLICY_MATRIX_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every PrivacyMode and every major PolicyDomain", () => {
    for (const mode of ALL_MODES) {
      for (const domain of MAJOR_POLICY_DOMAINS) {
        expect(
          POLICY_MATRIX_RULES.some((r) => r.mode === mode && r.domain === domain),
          `${mode}/${domain}`,
        ).toBe(true);
      }
    }
  });

  it("v1 invariants: no rule persists or egresses", () => {
    for (const rule of POLICY_MATRIX_RULES) {
      expect(rule.persistentAllowed, rule.id).toBe(false);
      expect(rule.networkAllowed, rule.id).toBe(false);
    }
  });
});

describe("Fail closed (tests 4-6)", () => {
  it("unknown mode denies", () => {
    const d = evaluatePolicyMatrix({
      mode: "party" as PrivacyMode,
      domain: "storage",
      operation: "storage.write.memory",
    });
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe("unknown_input");
  });

  it("unknown domain denies", () => {
    const d = evaluatePolicyMatrix({
      mode: "standard",
      domain: "teleportation" as PolicyDomain,
      operation: "anything",
    });
    expect(d.allowed).toBe(false);
    expect(d.effect).toBe("deny");
  });

  it("unknown operation denies", () => {
    const d = decide("storage", "storage.write.everything_forever", "standard");
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe("unknown_input");
  });
});

describe("Composition (tests 7-12)", () => {
  it("deny overrides allow; empty input fails closed", () => {
    expect(combinePolicyEffects(["allow", "deny", "redact"])).toBe("deny");
    expect(combinePolicyEffects([])).toBe("deny");
    expect(isEffectStricterThan("deny", "allow")).toBe(true);
    expect(isEffectStricterThan("memory_only", "allow")).toBe(true);
    expect(isEffectStricterThan("null", "memory_only")).toBe(true);
  });

  it("future_gate and not_implemented are not allow (tests 8-9)", () => {
    expect(combinePolicyEffects(["allow", "future_gate"])).toBe("future_gate");
    expect(combinePolicyEffects(["allow", "not_implemented"])).toBe("not_implemented");
    const gate = decide("crypto", "crypto.any", "standard");
    expect(gate.effect).toBe("future_gate");
    expect(gate.allowed).toBe(false);
    const ni = decide("notification", "notification.badge.count", "standard");
    expect(ni.effect).toBe("not_implemented");
    expect(ni.allowed).toBe(false);
  });

  it("applyStrictestPolicy picks strictest and requires unanimity for allow", () => {
    const allow: PolicyMatrixDecision = decide("metadata", "audit_event.write", "private");
    const deny: PolicyMatrixDecision = decide("metadata", "receipt.read", "private");
    expect(allow.allowed).toBe(true);
    const combined = applyStrictestPolicy([allow, deny]);
    expect(combined.allowed).toBe(false);
    expect(combined.effect).toBe("deny");
    expect(applyStrictestPolicy([]).allowed).toBe(false);
  });

  it("room policy cannot loosen device policy (test 10)", () => {
    const d = evaluatePolicyMatrix({
      mode: "private",
      domain: "metadata",
      operation: "receipt.read",
      roomPolicy: { allowed: true, effect: "allow" },
    });
    expect(d.allowed).toBe(false);
    // ...but can tighten an allowed row.
    const tightened = evaluatePolicyMatrix({
      mode: "private",
      domain: "metadata",
      operation: "audit_event.write",
      roomPolicy: { allowed: false },
    });
    expect(tightened.allowed).toBe(false);
    expect(tightened.reasonCode).toBe("room_policy_stricter");
  });

  it("ScreenShield sealed/bunker tightens shield-marked rows (test 11)", () => {
    const open = evaluatePolicyMatrix({
      mode: "standard",
      domain: "endpoint",
      operation: "protected_content.reveal",
    });
    expect(open.allowed).toBe(true);
    const sealed = evaluatePolicyMatrix({
      mode: "standard",
      domain: "endpoint",
      operation: "protected_content.reveal",
      screenShieldLevel: "sealed",
    });
    expect(sealed.allowed).toBe(false);
    expect(sealed.reasonCode).toBe("screen_shield_strict");
    const critical = evaluatePolicyMatrix({
      mode: "standard",
      domain: "endpoint",
      operation: "protected_content.reveal",
      deviceRiskLevel: "critical",
    });
    expect(critical.allowed).toBe(false);
  });

  it("Emergency overrides normal allow (test 12)", () => {
    expect(decide("storage", "storage.write.memory", "private").allowed).toBe(true);
    expect(decide("storage", "storage.write.memory", "emergency").allowed).toBe(false);
    expect(decide("metadata", "log.write", "emergency").allowed).toBe(false);
  });
});

describe("Per-mode invariants (tests 13-31)", () => {
  it("Offline Capsule denies network (test 13)", () => {
    for (const rule of POLICY_MATRIX_RULES) {
      if (rule.mode === "offline_capsule" && rule.domain === "network") {
        expect(rule.allowed, rule.id).toBe(false);
      }
    }
  });

  it("Ghost/Bunker deny persistent content writes (tests 14-15)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      expect(decide("storage", "storage.write.persistent", mode).allowed, mode).toBe(false);
      expect(decide("storage", "storage.write.protected_reveal_state", mode).allowed, mode).toBe(
        false,
      );
    }
  });

  it("Ghost/Bunker deny AI (tests 16-17)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const d = decide("ai", "ai.local_request", mode);
      expect(d.allowed, mode).toBe(false);
      expect(d.reasonCode, mode).toBe("ai_forbidden");
    }
  });

  it("telemetry / external assets / previews / push always denied (tests 18-21)", () => {
    for (const mode of ALL_MODES) {
      expect(decide("network", "telemetry.send", mode).allowed, mode).toBe(false);
      expect(decide("network", "asset.fetch", mode).allowed, mode).toBe(false);
      expect(decide("link_preview", "preview.automatic", mode).allowed, mode).toBe(false);
      expect(decide("notification", "notification.push_subscribe", mode).allowed, mode).toBe(false);
      expect(decide("external_asset", "asset.tracking_pixel", mode).allowed, mode).toBe(false);
    }
  });

  it("Private+ denies receipts/typing/presence (tests 22-24)", () => {
    for (const mode of ALL_MODES) {
      expect(decide("metadata", "receipt.read", mode).allowed, mode).toBe(false);
      expect(decide("metadata", "typing.start", mode).allowed, mode).toBe(false);
      expect(decide("metadata", "presence.online", mode).allowed, mode).toBe(false);
    }
  });

  it("Ghost denies notification content; Bunker denies badge/sound/vibration (tests 25-26)", () => {
    expect(decide("notification", "notification.show.message_preview", "ghost").allowed).toBe(
      false,
    );
    expect(decide("notification", "notification.show.in_app_generic", "ghost").allowed).toBe(false);
    expect(decide("notification", "notification.badge.count", "bunker").allowed).toBe(false);
    expect(decide("notification", "notification.sound", "bunker").allowed).toBe(false);
    expect(decide("notification", "notification.vibration", "bunker").allowed).toBe(false);
  });

  it("deferred gates stay gated (tests 27-31)", () => {
    for (const mode of ALL_MODES) {
      expect(decide("storage", "storage.backend.encrypted_persistent", mode).effect, mode).toBe(
        "future_gate",
      );
      expect(decide("crypto", "crypto.any", mode).effect, mode).toBe("future_gate");
      expect(decide("capsule", "capsule.wire_format", mode).effect, mode).toBe("future_gate");
      expect(decide("room", "room.sync", mode).effect, mode).toBe("future_gate");
      expect(decide("identity", "identity.invite", mode).effect, mode).toBe("future_gate");
    }
  });
});

describe("Matrix agrees with the concrete policy engines (tests 32-37)", () => {
  it("StoragePolicy: Ghost/Bunker persistent writes (test 32)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const matrix = decide("storage", "storage.write.persistent", mode);
      const storage = resolveStoragePolicy({
        mode,
        dataClass: "message_content",
        sensitivity: "content",
      });
      expect(matrix.allowed, mode).toBe(false);
      expect(storage.persistentAllowed, mode).toBe(false);
    }
    // Preview caches: matrix and storage agree in Private+.
    for (const mode of ["private", "ghost", "bunker"] as const) {
      expect(decide("storage", "storage.write.preview_cache", mode).allowed, mode).toBe(false);
      expect(
        resolveStoragePolicy({ mode, dataClass: "preview_cache", sensitivity: "metadata" })
          .allowWrite,
        mode,
      ).toBe(false);
    }
  });

  it("NetworkPolicy: Offline Capsule network denial + always-forbidden ops (test 33)", () => {
    const matrix = decide("network", "network.request", "offline_capsule");
    const net = resolveNetworkPolicy({
      mode: "offline_capsule",
      operation: "network.request",
      transportClass: "http",
    });
    expect(matrix.allowed).toBe(false);
    expect(net.allowed).toBe(false);
    for (const mode of ALL_MODES) {
      expect(decide("network", "telemetry.send", mode).allowed, mode).toBe(
        resolveNetworkPolicy({ mode, operation: "telemetry.send", transportClass: "relay" })
          .allowed,
      );
      expect(decide("network", "link.preview", mode).allowed, mode).toBe(
        resolveNetworkPolicy({ mode, operation: "link.preview", transportClass: "relay" }).allowed,
      );
    }
  });

  it("MetadataPolicy: Private+ receipts/typing/presence (test 34)", () => {
    for (const mode of ALL_MODES) {
      for (const [op, event] of [
        ["receipt.read", "receipt.read"],
        ["typing.start", "typing.start"],
        ["presence.online", "presence.online"],
      ] as const) {
        const matrix = decide("metadata", op, mode);
        const meta = resolveMetadataPolicy({ mode, event, sink: "transport_envelope" });
        expect(matrix.allowed, `${mode}/${op}`).toBe(meta.allowed);
      }
    }
  });

  it("LinkPreviewPolicy: automatic preview denial (test 35)", () => {
    for (const mode of ALL_MODES) {
      const matrix = decide("link_preview", "preview.automatic", mode);
      const link = resolveLinkPreviewPolicy({ mode });
      expect(matrix.allowed, mode).toBe(false);
      expect(link.automaticPreviewAllowed, mode).toBe(false);
      expect(matrix.allowed, mode).toBe(link.automaticPreviewAllowed);
    }
  });

  it("ExternalAssetPolicy: remote asset denial (test 36)", () => {
    for (const mode of ALL_MODES) {
      for (const kind of [
        "remote_image",
        "remote_avatar",
        "tracking_pixel",
        "preconnect",
      ] as const) {
        const matrix = decide("external_asset", `asset.${kind}`, mode);
        const asset = resolveExternalAssetPolicy({ mode, assetKind: kind });
        expect(matrix.allowed, `${mode}/${kind}`).toBe(asset.allowed);
        expect(matrix.allowed, `${mode}/${kind}`).toBe(false);
      }
    }
  });

  it("NotificationPolicy: push + message preview denial (test 37)", () => {
    for (const mode of ALL_MODES) {
      const matrixPush = decide("notification", "notification.push_subscribe", mode);
      const notifPush = resolveNotificationPolicy({
        mode,
        operation: "notification.push_subscribe",
        contentClass: "generic",
        surface: "push_service",
      });
      expect(matrixPush.allowed, mode).toBe(notifPush.allowed);
      const matrixPreview = decide("notification", "notification.show.message_preview", mode);
      const notifPreview = resolveNotificationPolicy({
        mode,
        operation: "notification.show",
        contentClass: "message_preview",
        surface: "system_banner",
      });
      expect(matrixPreview.allowed, mode).toBe(notifPreview.allowed);
    }
    // The one allowed notification path also agrees.
    const matrixInApp = decide("notification", "notification.show.in_app_generic", "standard");
    const notifInApp = resolveNotificationPolicy({
      mode: "standard",
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
    });
    expect(matrixInApp.allowed).toBe(true);
    expect(notifInApp.allowed).toBe(true);
  });

  it("ScreenShield hooks: protected reveal persistence denial agrees", () => {
    for (const mode of ALL_MODES) {
      const matrix = decide("endpoint", "protected_content.reveal_persist", mode);
      const meta = resolveMetadataPolicy({
        mode,
        event: "protected_content.revealed",
        sink: "local_persistent_storage",
      });
      expect(matrix.allowed, mode).toBe(false);
      expect(meta.allowed, mode).toBe(false);
    }
  });
});
