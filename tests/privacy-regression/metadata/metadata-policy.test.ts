/**
 * Privacy-regression (TECH-10): MetadataPolicy matrix — default deny,
 * application-signal denial, notification/AI/asset denial, persistent/network
 * sink denial, strictest-wins room composition, and the metadata barrier's
 * accept/reject behavior against the existing PolicyDecision authenticity.
 */
import { describe, expect, it } from "vitest";
import {
  assertMetadataOperationAllowed,
  evaluateExternalAssetMetadataPolicy,
  evaluateLinkPreviewMetadataPolicy,
  evaluateNotificationMetadataPolicy,
  evaluatePresencePolicy,
  evaluateReadReceiptPolicy,
  evaluateTypingPolicy,
  expectedMetadataCapability,
  expectedMetadataScope,
  issuePolicyDecision,
  resolveMetadataPolicy,
  type MetadataEventKind,
  type MetadataOperationRequest,
  type MetadataSink,
  type PolicyDecision,
} from "@freelayer/privacy";
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
const PRIVATE_PLUS: readonly PrivacyMode[] = [
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

function decisionFor(
  event: MetadataEventKind,
  sink: MetadataSink,
  mode: PrivacyMode,
  verdict: "allowed" | "denied" = "allowed",
): PolicyDecision {
  return issuePolicyDecision(
    expectedMetadataCapability(event),
    verdict,
    mode,
    expectedMetadataScope(event, sink),
  );
}

describe("Fail closed", () => {
  it("unknown event is denied (test 1)", () => {
    expect(
      resolveMetadataPolicy({ mode: "standard", event: "unknown", sink: "local_memory" }).allowed,
    ).toBe(false);
    expect(
      resolveMetadataPolicy({
        mode: "standard",
        event: "totally.invalid" as MetadataEventKind,
        sink: "local_memory",
      }).allowed,
    ).toBe(false);
  });

  it("unknown sink is denied (test 2)", () => {
    expect(
      resolveMetadataPolicy({ mode: "standard", event: "audit_event.write", sink: "unknown" })
        .allowed,
    ).toBe(false);
    expect(
      resolveMetadataPolicy({
        mode: "standard",
        event: "audit_event.write",
        sink: "carrier_pigeon" as MetadataSink,
      }).allowed,
    ).toBe(false);
  });

  it("unknown mode is denied", () => {
    expect(
      resolveMetadataPolicy({
        mode: "party" as PrivacyMode,
        event: "audit_event.write",
        sink: "audit",
      }).allowed,
    ).toBe(false);
  });
});

describe("Application signals denied (receipts/typing/presence)", () => {
  it("read receipts denied in every mode incl. Private/Ghost/Bunker (tests 3-5)", () => {
    for (const mode of ALL_MODES) {
      expect(evaluateReadReceiptPolicy({ mode }).allowed, mode).toBe(false);
      expect(evaluateReadReceiptPolicy({ mode, kind: "delivery" }).allowed, mode).toBe(false);
    }
  });

  it("typing denied in every mode incl. Private/Ghost/Bunker (tests 6-8)", () => {
    for (const mode of ALL_MODES) {
      expect(evaluateTypingPolicy({ mode }).allowed, mode).toBe(false);
      expect(evaluateTypingPolicy({ mode, phase: "stop" }).allowed, mode).toBe(false);
    }
  });

  it("presence denied in every mode incl. Private/Ghost/Bunker (tests 9-11)", () => {
    for (const mode of ALL_MODES) {
      expect(evaluatePresencePolicy({ mode }).allowed, mode).toBe(false);
    }
  });

  it("last seen denied in Private+ (test 12)", () => {
    for (const mode of PRIVATE_PLUS) {
      expect(evaluatePresencePolicy({ mode, state: "last_seen" }).allowed, mode).toBe(false);
    }
  });

  it("room.activity denied in Bunker (test 18, activity)", () => {
    expect(
      resolveMetadataPolicy({ mode: "bunker", event: "room.activity", sink: "ui" }).allowed,
    ).toBe(false);
  });
});

describe("Link previews and external assets denied everywhere", () => {
  it("automatic link preview denied in all modes (test 13)", () => {
    for (const mode of ALL_MODES) {
      expect(evaluateLinkPreviewMetadataPolicy({ mode }).allowed, mode).toBe(false);
    }
  });

  it("external asset fetch denied in all modes (test 14)", () => {
    for (const mode of ALL_MODES) {
      expect(evaluateExternalAssetMetadataPolicy({ mode }).allowed, mode).toBe(false);
    }
  });

  it("remote avatar denied in all modes (test 15)", () => {
    for (const mode of ALL_MODES) {
      expect(evaluateExternalAssetMetadataPolicy({ mode, kind: "avatar" }).allowed, mode).toBe(
        false,
      );
    }
  });

  it("external navigation metadata denied in all modes", () => {
    for (const mode of ALL_MODES) {
      expect(
        resolveMetadataPolicy({ mode, event: "external.navigation", sink: "network" }).allowed,
        mode,
      ).toBe(false);
    }
  });
});

describe("Notification metadata", () => {
  it("notification content denied in Ghost (test 16)", () => {
    expect(evaluateNotificationMetadataPolicy({ mode: "ghost", part: "preview" }).allowed).toBe(
      false,
    );
  });

  it("notification content denied in Bunker (test 17)", () => {
    expect(evaluateNotificationMetadataPolicy({ mode: "bunker", part: "preview" }).allowed).toBe(
      false,
    );
  });

  it("badge metadata denied in Bunker (test 18, badge)", () => {
    expect(evaluateNotificationMetadataPolicy({ mode: "bunker", part: "badge" }).allowed).toBe(
      false,
    );
    expect(evaluateNotificationMetadataPolicy({ mode: "bunker", part: "sound" }).allowed).toBe(
      false,
    );
  });

  it("notification content denied in every mode in v0", () => {
    for (const mode of ALL_MODES) {
      expect(evaluateNotificationMetadataPolicy({ mode, part: "preview" }).allowed, mode).toBe(
        false,
      );
    }
  });
});

describe("AI, protected-reveal, network and persistent sinks", () => {
  it("AI prompt/cache/summary metadata denied in Ghost/Bunker (test 19)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      for (const event of ["ai.prompt_exists", "ai.cache_exists", "ai.summary_exists"] as const) {
        expect(resolveMetadataPolicy({ mode, event, sink: "ai" }).allowed, `${mode}/${event}`).toBe(
          false,
        );
      }
    }
  });

  it("protected reveal-state persistence denied in sealed/Ghost/Bunker (test 20)", () => {
    // persistence sink denied in every mode
    for (const mode of ALL_MODES) {
      expect(
        resolveMetadataPolicy({
          mode,
          event: "protected_content.revealed",
          sink: "local_persistent_storage",
        }).allowed,
        mode,
      ).toBe(false);
    }
    // ScreenShield sealed denies even a memory reveal record
    expect(
      resolveMetadataPolicy({
        mode: "standard",
        event: "protected_content.revealed",
        sink: "local_memory",
        screenShieldLevel: "sealed",
      }).allowed,
    ).toBe(false);
    // Ghost/Bunker deny reveal state outright
    for (const mode of ["ghost", "bunker"] as const) {
      expect(
        resolveMetadataPolicy({ mode, event: "protected_content.revealed", sink: "local_memory" })
          .allowed,
        mode,
      ).toBe(false);
    }
  });

  it("network sink denied in Offline Capsule (test 21)", () => {
    expect(
      resolveMetadataPolicy({ mode: "offline_capsule", event: "transport.poll", sink: "network" })
        .allowed,
    ).toBe(false);
    expect(
      resolveMetadataPolicy({
        mode: "offline_capsule",
        event: "audit_event.write",
        sink: "network",
      }).allowed,
    ).toBe(false);
  });

  it("persistent metadata sink denied in Ghost/Bunker (test 22)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      expect(
        resolveMetadataPolicy({
          mode,
          event: "audit_event.write",
          sink: "local_persistent_storage",
        }).allowed,
        mode,
      ).toBe(false);
      expect(
        resolveMetadataPolicy({
          mode,
          event: "capsule.spool_timestamp",
          sink: "local_persistent_storage",
        }).allowed,
        mode,
      ).toBe(false);
    }
  });

  it("telemetry-shaped (networked) metadata default-denied (test 32)", () => {
    for (const mode of ALL_MODES) {
      expect(
        resolveMetadataPolicy({ mode, event: "transport.size", sink: "network" }).allowed,
        mode,
      ).toBe(false);
    }
  });
});

describe("Room composition (strictest wins)", () => {
  it("room cannot loosen a Private device's receipt denial (test 23)", () => {
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "receipt.read",
      sink: "transport_envelope",
      roomPolicy: { allowed: true },
    });
    expect(policy.allowed).toBe(false);
  });

  it("Standard room (permissive) + Ghost device = Ghost restrictions (test 24)", () => {
    const policy = resolveMetadataPolicy({
      mode: "ghost",
      event: "notification.preview",
      sink: "notification_system",
      roomPolicy: { allowed: true },
    });
    expect(policy.allowed).toBe(false);
  });

  it("Standard room (permissive) + Bunker device = Bunker restrictions (test 25)", () => {
    const policy = resolveMetadataPolicy({
      mode: "bunker",
      event: "room.activity",
      sink: "ui",
      roomPolicy: { allowed: true },
    });
    expect(policy.allowed).toBe(false);
  });

  it("room can tighten an otherwise-allowed audit event", () => {
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
      roomPolicy: { allowed: false },
    });
    expect(policy.allowed).toBe(false);
  });
});

describe("Metadata barrier — accept and reject", () => {
  it("accepts a genuine, correctly-scoped decision for an allowed audit event", () => {
    const request: MetadataOperationRequest = {
      event: "audit_event.write",
      sink: "audit",
      sensitivity: "low",
      reason: "policy audit",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
    });
    expect(policy.allowed).toBe(true);
    const decision = decisionFor("audit_event.write", "audit", "private");
    expect(() => assertMetadataOperationAllowed(request, decision, policy)).not.toThrow();
  });

  it("rejects a fake (structurally-forged) decision (test 33)", () => {
    const request: MetadataOperationRequest = {
      event: "audit_event.write",
      sink: "audit",
      sensitivity: "low",
      reason: "policy audit",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
    });
    const real = decisionFor("audit_event.write", "audit", "private");
    const forged = { ...real } as PolicyDecision; // perfect structural copy, not registered
    expect(() => assertMetadataOperationAllowed(request, forged, policy)).toThrow(/bypass/i);
  });

  it("rejects a wrong side-effect decision (test 34)", () => {
    const request: MetadataOperationRequest = {
      event: "audit_event.write",
      sink: "audit",
      sensitivity: "low",
      reason: "policy audit",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
    });
    // Correct capability, WRONG side-effect scope.
    const wrong = issuePolicyDecision("persistence", "allowed", "private", "metadata.emit");
    expect(() => assertMetadataOperationAllowed(request, wrong, policy)).toThrow(/mismatch/i);
  });

  it("rejects a denied decision", () => {
    const request: MetadataOperationRequest = {
      event: "audit_event.write",
      sink: "audit",
      sensitivity: "low",
      reason: "policy audit",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "audit_event.write",
      sink: "audit",
    });
    const denied = decisionFor("audit_event.write", "audit", "private", "denied");
    expect(() => assertMetadataOperationAllowed(request, denied, policy)).toThrow();
  });

  it("denies before any downstream provider call (test 35)", () => {
    let providerCalled = false;
    const emit = (): void => {
      providerCalled = true;
    };
    const request: MetadataOperationRequest = {
      event: "typing.start",
      sink: "transport_envelope",
      sensitivity: "relationship",
      reason: "typing",
    };
    const policy = resolveMetadataPolicy({
      mode: "private",
      event: "typing.start",
      sink: "transport_envelope",
    });
    const decision = decisionFor("typing.start", "transport_envelope", "private");
    expect(() => {
      assertMetadataOperationAllowed(request, decision, policy);
      emit();
    }).toThrow();
    expect(providerCalled).toBe(false);
  });
});
