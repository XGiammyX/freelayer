/**
 * Privacy-regression (TECH-12): NotificationPolicy — permission requests, push,
 * service worker, content previews, badges, sound/vibration all denied; the
 * only allowed path is a generic memory-only in-app indicator. Composes with
 * Metadata/Storage/Network under strictest-wins.
 */
import { describe, expect, it } from "vitest";
import {
  assertNotificationOperationAllowed,
  expectedNotificationScope,
  issuePolicyDecision,
  redactNotificationContent,
  resolveBadgePolicy,
  resolveNotificationPolicy,
  resolveNotificationSoundPolicy,
  resolveNotificationVibrationPolicy,
  resolvePushNotificationPolicy,
  resolveMetadataPolicy,
  type NotificationContentClass,
  type NotificationOperationKind,
  type NotificationOperationRequest,
  type PolicyDecision,
  type PrivacyMode,
} from "@freelayer/privacy";
import { resolveNetworkPolicy } from "@freelayer/transports";
import { resolveStoragePolicy } from "@freelayer/storage";

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
  operation: NotificationOperationKind,
  mode: PrivacyMode,
  verdict: "allowed" | "denied" = "allowed",
): PolicyDecision {
  return issuePolicyDecision("notifications", verdict, mode, expectedNotificationScope(operation));
}

describe("Permission requests and push denied everywhere", () => {
  it("permission request denied in all modes (tests 1-6)", () => {
    for (const mode of ALL_MODES) {
      expect(
        resolveNotificationPolicy({
          mode,
          operation: "notification.permission_request",
          contentClass: "generic",
          surface: "system_banner",
        }).allowed,
        mode,
      ).toBe(false);
    }
  });

  it("push subscribe/receive and service worker show denied in all modes (tests 21-23)", () => {
    for (const mode of ALL_MODES) {
      expect(resolvePushNotificationPolicy({ mode, contentClass: "generic" }).allowed, mode).toBe(
        false,
      );
      expect(
        resolvePushNotificationPolicy({
          mode,
          contentClass: "generic",
          operation: "notification.push_receive",
        }).allowed,
        mode,
      ).toBe(false);
      expect(
        resolveNotificationPolicy({
          mode,
          operation: "notification.service_worker_show",
          contentClass: "generic",
          surface: "service_worker",
        }).allowed,
        mode,
      ).toBe(false);
    }
  });
});

describe("Content previews denied", () => {
  it("message preview denied in Standard/Private/Ghost/Bunker (tests 7-10)", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      expect(
        resolveNotificationPolicy({
          mode,
          operation: "notification.show",
          contentClass: "message_preview",
          surface: "system_banner",
        }).allowed,
        mode,
      ).toBe(false);
    }
  });

  it("room name / sender alias denied in Private+ (tests 11-12)", () => {
    for (const mode of PRIVATE_PLUS) {
      for (const contentClass of ["room_name", "sender_alias"] as const) {
        expect(
          resolveNotificationPolicy({
            mode,
            operation: "notification.show",
            contentClass,
            surface: "system_banner",
          }).allowed,
          `${mode}/${contentClass}`,
        ).toBe(false);
      }
    }
  });

  it("protected/secret/ai_summary content denied in all modes (tests 13-15)", () => {
    for (const mode of ALL_MODES) {
      for (const contentClass of ["protected_content", "secret", "ai_summary"] as const) {
        expect(
          resolveNotificationPolicy({
            mode,
            operation: "notification.show",
            contentClass,
            surface: "system_banner",
          }).allowed,
          `${mode}/${contentClass}`,
        ).toBe(false);
      }
    }
  });
});

describe("Badge, sound, vibration denied", () => {
  it("badge denied in Ghost/Bunker/Emergency (tests 16-18)", () => {
    for (const mode of ["ghost", "bunker", "emergency"] as const) {
      expect(resolveBadgePolicy({ mode, contentClass: "activity_count" }).badgeAllowed, mode).toBe(
        false,
      );
      expect(resolveBadgePolicy({ mode, contentClass: "activity_count" }).allowed, mode).toBe(
        false,
      );
    }
  });

  it("badge denied in every mode in v0 (not implemented)", () => {
    for (const mode of ALL_MODES) {
      expect(resolveBadgePolicy({ mode, contentClass: "generic" }).allowed, mode).toBe(false);
    }
  });

  it("sound and vibration denied in Bunker and Emergency (tests 19-20)", () => {
    for (const mode of ["bunker", "emergency"] as const) {
      expect(
        resolveNotificationSoundPolicy({ mode, contentClass: "generic" }).soundAllowed,
        mode,
      ).toBe(false);
      expect(resolveNotificationSoundPolicy({ mode, contentClass: "generic" }).allowed, mode).toBe(
        false,
      );
      expect(
        resolveNotificationVibrationPolicy({ mode, contentClass: "generic" }).allowed,
        mode,
      ).toBe(false);
    }
  });
});

describe("Storage / persistence", () => {
  it("notification content never persists (test 24)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const p = resolveNotificationPolicy({
        mode,
        operation: "notification.show",
        contentClass: "generic",
        surface: "in_app",
      });
      expect(p.persistentStorageAllowed, mode).toBe(false);
    }
  });
});

describe("Room composition (strictest wins)", () => {
  it("room cannot loosen a Private device's content denial (test 26)", () => {
    const p = resolveNotificationPolicy({
      mode: "private",
      operation: "notification.show",
      contentClass: "message_preview",
      surface: "system_banner",
      roomPolicy: { allowed: true, contentAllowed: true },
    });
    expect(p.allowed).toBe(false);
  });

  it("Standard room (permissive) + Ghost/Bunker device = strict restrictions (tests 27-28)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const p = resolveNotificationPolicy({
        mode,
        operation: "notification.show",
        contentClass: "generic",
        surface: "in_app",
        roomPolicy: { allowed: true },
      });
      expect(p.allowed, mode).toBe(false);
    }
  });
});

describe("Cross-policy agreement", () => {
  it("NotificationPolicy and MetadataPolicy agree on content denial (test 29)", () => {
    const notif = resolveNotificationPolicy({
      mode: "private",
      operation: "notification.preview",
      contentClass: "message_preview",
      surface: "system_banner",
    });
    const meta = resolveMetadataPolicy({
      mode: "private",
      event: "notification.preview",
      sink: "notification_system",
    });
    expect(notif.allowed).toBe(false);
    expect(meta.allowed).toBe(false);
  });

  it("NotificationPolicy and StoragePolicy agree on content storage denial (test 30)", () => {
    for (const mode of ["ghost", "bunker"] as const) {
      const notif = resolveNotificationPolicy({
        mode,
        operation: "notification.show",
        contentClass: "message_preview",
        surface: "notification_center",
      });
      const store = resolveStoragePolicy({
        mode,
        dataClass: "message_content",
        sensitivity: "content",
      });
      expect(notif.persistentStorageAllowed, mode).toBe(false);
      expect(store.persistentAllowed, mode).toBe(false);
    }
  });

  it("NotificationPolicy and NetworkPolicy agree on push denial (test 31)", () => {
    const push = resolvePushNotificationPolicy({ mode: "standard", contentClass: "generic" });
    const net = resolveNetworkPolicy({
      mode: "standard",
      operation: "network.request",
      transportClass: "http",
    });
    expect(push.pushAllowed).toBe(false);
    expect(push.networkAllowed).toBe(false);
    expect(net.allowed).toBe(false);
  });
});

describe("Fail closed and the single allowed path", () => {
  it("unknown operation/surface/content denied (test 32)", () => {
    expect(
      resolveNotificationPolicy({
        mode: "standard",
        operation: "notification.unknown",
        contentClass: "generic",
        surface: "in_app",
      }).allowed,
    ).toBe(false);
    expect(
      resolveNotificationPolicy({
        mode: "standard",
        operation: "notification.show",
        contentClass: "unknown",
        surface: "in_app",
      }).allowed,
    ).toBe(false);
    expect(
      resolveNotificationPolicy({
        mode: "standard",
        operation: "notification.show",
        contentClass: "generic",
        surface: "unknown",
      }).allowed,
    ).toBe(false);
  });

  it("allows a generic memory-only in-app indicator in Standard/Private only", () => {
    const p = resolveNotificationPolicy({
      mode: "standard",
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
    });
    expect(p.allowed).toBe(true);
    expect(p.action).toBe("allow_generic_only");
    expect(p.persistentStorageAllowed).toBe(false);
    expect(p.networkAllowed).toBe(false);
    // Ghost denies even the generic in-app indicator.
    expect(
      resolveNotificationPolicy({
        mode: "ghost",
        operation: "notification.show",
        contentClass: "generic",
        surface: "in_app",
      }).allowed,
    ).toBe(false);
  });
});

describe("Notification barrier — accept and reject", () => {
  const genericRequest: NotificationOperationRequest = {
    operation: "notification.show",
    contentClass: "generic",
    surface: "in_app",
    reason: "in-app indicator",
  };

  it("accepts a genuine decision for the allowed in-app indicator", () => {
    const policy = resolveNotificationPolicy({
      mode: "standard",
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
    });
    const decision = decisionFor("notification.show", "standard");
    expect(() =>
      assertNotificationOperationAllowed(genericRequest, decision, policy),
    ).not.toThrow();
  });

  it("rejects a forged decision", () => {
    const policy = resolveNotificationPolicy({
      mode: "standard",
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
    });
    const forged = { ...decisionFor("notification.show", "standard") } as PolicyDecision;
    expect(() => assertNotificationOperationAllowed(genericRequest, forged, policy)).toThrow(
      /bypass/i,
    );
  });

  it("rejects a wrong side-effect decision", () => {
    const policy = resolveNotificationPolicy({
      mode: "standard",
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
    });
    const wrong = issuePolicyDecision("notifications", "allowed", "standard", "notification.badge");
    expect(() => assertNotificationOperationAllowed(genericRequest, wrong, policy)).toThrow(
      /mismatch/i,
    );
  });

  it("denies a message-preview request before any provider call (test: denial precedes side effect)", () => {
    let providerCalled = false;
    const request: NotificationOperationRequest = {
      operation: "notification.show",
      contentClass: "message_preview" as NotificationContentClass,
      surface: "system_banner",
      reason: "preview",
    };
    const policy = resolveNotificationPolicy({
      mode: "private",
      operation: "notification.show",
      contentClass: "message_preview",
      surface: "system_banner",
    });
    const decision = decisionFor("notification.show", "private");
    expect(() => {
      assertNotificationOperationAllowed(request, decision, policy);
      providerCalled = true;
    }).toThrow();
    expect(providerCalled).toBe(false);
  });
});

describe("Content redaction", () => {
  it("redacts to generic labels; strict modes empty", () => {
    const std = redactNotificationContent({
      contentClass: "message_preview",
      title: "x",
      body: "y",
      mode: "standard",
    });
    expect(std.title).toBe("FreeLayer");
    expect(std.body).toBe("New activity");
    expect(std.redacted).toBe(true);
    const ghost = redactNotificationContent({
      contentClass: "message_preview",
      title: "x",
      body: "y",
      mode: "ghost",
    });
    expect(ghost.title).toBe("");
    expect(ghost.body).toBe("");
  });
});
