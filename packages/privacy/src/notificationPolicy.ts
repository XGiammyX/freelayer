/**
 * NotificationPolicy v0 — the mode × operation × content × surface matrix
 * (TECH-12).
 *
 * Principles, in order:
 *   1. DEFAULT DENY — notifications are side effects; nothing is allowed unless
 *      explicitly permitted.
 *   2. NOTHING LEAVES THE APP — in v0 the ONLY allowed notification is a
 *      memory-only, generic, in-app indicator in Standard/Private. Every OS
 *      surface (banner, lock screen, notification center, badge, sound,
 *      vibration, push, service worker) is denied.
 *   3. STRICTEST WINS — room policy composes tighten-only.
 *
 * No permission prompts, no push, no service worker, no real notifications —
 * this only decides (docs/PRIVACY_MODEL.md, docs/METADATA_MODEL.md).
 */

import type { PrivacyMode } from "./index";
import {
  GENERIC_CONTENT_CLASSES,
  NOTIFICATION_CONTENT_CLASSES,
  NOTIFICATION_OPERATION_KINDS,
  NOTIFICATION_SURFACES,
  SENSITIVE_CONTENT_CLASSES,
  type NotificationContentClass,
  type NotificationPolicy,
  type NotificationPolicyInput,
  type NotificationPrivacyAction,
  type RedactedNotificationContent,
} from "./notificationTypes";

const KNOWN_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

/** Modes where a generic, memory-only in-app indicator may be modeled. */
const IN_APP_INDICATOR_MODES: readonly PrivacyMode[] = ["standard", "private", "sovereign_room"];

interface Draft {
  action: NotificationPrivacyAction;
  allowed: boolean;
  contentAllowed: boolean;
  userVisibleWarningRequired: boolean;
  reasons: string[];
}

function deny(reason: string, action: NotificationPrivacyAction = "deny"): Draft {
  return {
    action,
    allowed: false,
    contentAllowed: false,
    userVisibleWarningRequired: false,
    reasons: [reason],
  };
}

function allowGeneric(reason: string): Draft {
  return {
    action: "allow_generic_only",
    allowed: true,
    contentAllowed: true,
    userVisibleWarningRequired: false,
    reasons: [reason],
  };
}

export function resolveNotificationPolicy(input: NotificationPolicyInput): NotificationPolicy {
  const { mode, operation, contentClass, surface } = input;
  const shield = input.screenShieldLevel ?? "off";
  const sealed = shield === "sealed" || shield === "bunker";

  const finalize = (draft: Draft): NotificationPolicy => {
    // Room composition: TIGHTEN ONLY.
    const room = input.roomPolicy;
    let allowed = draft.allowed;
    let contentAllowed = draft.contentAllowed;
    let warn = draft.userVisibleWarningRequired;
    const reasons = [...draft.reasons];
    if (room !== undefined) {
      allowed = allowed && (room.allowed ?? true);
      contentAllowed = contentAllowed && (room.contentAllowed ?? true);
      warn = warn || (room.userVisibleWarningRequired ?? false);
      reasons.push("room policy composed (tighten-only)");
    }
    return {
      mode,
      operation,
      contentClass,
      surface,
      action: allowed
        ? draft.action
        : draft.action === "not_implemented"
          ? "not_implemented"
          : "deny",
      allowed,
      // v0 invariants: nothing below ever flips true.
      permissionRequestAllowed: false,
      contentAllowed: allowed ? contentAllowed : false,
      badgeAllowed: false,
      soundAllowed: false,
      vibrationAllowed: false,
      pushAllowed: false,
      persistentStorageAllowed: false,
      networkAllowed: false,
      userVisibleWarningRequired: warn,
      reason: reasons.join("; "),
    };
  };

  // ---- FAIL CLOSED ----
  if (
    !KNOWN_MODES.includes(mode) ||
    contentClass === "unknown" ||
    operation === "notification.unknown" ||
    surface === "unknown" ||
    !NOTIFICATION_OPERATION_KINDS.includes(operation) ||
    !NOTIFICATION_CONTENT_CLASSES.includes(contentClass) ||
    !NOTIFICATION_SURFACES.includes(surface)
  ) {
    return finalize(deny("unknown mode/operation/content/surface: fail closed", "not_implemented"));
  }

  // ---- Push / service worker: denied in every mode (future ADR/gate) ----
  if (
    operation === "notification.push_subscribe" ||
    operation === "notification.push_receive" ||
    operation === "notification.service_worker_show" ||
    surface === "push_service" ||
    surface === "service_worker"
  ) {
    return finalize(
      deny(
        "push / service-worker notifications denied (no infrastructure; future gate)",
        "future_gate",
      ),
    );
  }

  // ---- Permission request: never automatic; a future explicit user action ----
  if (operation === "notification.permission_request") {
    return finalize(
      deny(
        "notification permission request denied by default (future user action)",
        "require_user_action",
      ),
    );
  }

  // ---- Protected/secret content: denied everywhere ----
  if (contentClass === "protected_content" || contentClass === "secret") {
    return finalize(deny("protected/secret content must never reach a notification"));
  }

  // ---- Badge / sound / vibration: metadata, not implemented, denied ----
  if (operation === "notification.badge" || surface === "app_badge") {
    return finalize(
      deny("badge is activity metadata; denied (not implemented)", "not_implemented"),
    );
  }
  if (operation === "notification.sound" || surface === "sound") {
    return finalize(
      deny("notification sound reveals activity; denied (not implemented)", "not_implemented"),
    );
  }
  if (operation === "notification.vibration" || surface === "vibration") {
    return finalize(
      deny("notification vibration reveals activity; denied (not implemented)", "not_implemented"),
    );
  }
  if (operation === "notification.channel_create") {
    return finalize(deny("notification channels can reveal room/project names; denied"));
  }

  // ---- OS-visible surfaces (banner / lock screen / notification center) ----
  if (
    surface === "system_banner" ||
    surface === "lock_screen" ||
    surface === "notification_center"
  ) {
    return finalize(
      deny(
        `system notification surface "${surface}" not implemented; content leaks outside the app`,
        "not_implemented",
      ),
    );
  }

  // ---- Sensitive content on ANY surface: denied ----
  if (SENSITIVE_CONTENT_CLASSES.includes(contentClass)) {
    return finalize(deny(`content class "${contentClass}" denied in every mode (sensitive)`));
  }

  // ---- The single allowed path: a generic, memory-only, IN-APP indicator ----
  if (
    surface === "in_app" &&
    GENERIC_CONTENT_CLASSES.includes(contentClass) &&
    IN_APP_INDICATOR_MODES.includes(mode) &&
    (operation === "notification.show" ||
      operation === "notification.group" ||
      operation === "notification.clear")
  ) {
    if (sealed && contentClass !== "none") {
      return finalize(
        deny("ScreenShield sealed: only a contentless in-app indicator is permitted"),
      );
    }
    return finalize(
      allowGeneric(`${mode}: generic memory-only in-app indicator (no OS surface, no content)`),
    );
  }

  return finalize(deny("no rule matched: default deny"));
}

// ---- Helper policies (all delegate to the single resolver) ----

export function resolveBadgePolicy(
  input: Omit<NotificationPolicyInput, "operation" | "surface">,
): NotificationPolicy {
  return resolveNotificationPolicy({
    ...input,
    operation: "notification.badge",
    surface: "app_badge",
  });
}

export function shouldAllowBadgeUpdate(
  input: Omit<NotificationPolicyInput, "operation" | "surface">,
): boolean {
  return resolveBadgePolicy(input).badgeAllowed;
}

export function resolveNotificationSoundPolicy(
  input: Omit<NotificationPolicyInput, "operation" | "surface">,
): NotificationPolicy {
  return resolveNotificationPolicy({ ...input, operation: "notification.sound", surface: "sound" });
}

export function resolveNotificationVibrationPolicy(
  input: Omit<NotificationPolicyInput, "operation" | "surface">,
): NotificationPolicy {
  return resolveNotificationPolicy({
    ...input,
    operation: "notification.vibration",
    surface: "vibration",
  });
}

export function resolvePushNotificationPolicy(
  input: Omit<NotificationPolicyInput, "operation" | "surface"> & {
    readonly operation?: "notification.push_subscribe" | "notification.push_receive";
  },
): NotificationPolicy {
  return resolveNotificationPolicy({
    ...input,
    operation: input.operation ?? "notification.push_subscribe",
    surface: "push_service",
  });
}

/**
 * Reduce any notification content to a generic, non-sensitive label. NEVER
 * includes the input title/body, room name, sender alias, or any content.
 * Strict modes (Ghost/Bunker/Emergency) return empty strings.
 */
export function redactNotificationContent(input: {
  readonly contentClass: NotificationContentClass;
  readonly title?: unknown;
  readonly body?: unknown;
  readonly mode: PrivacyMode;
}): RedactedNotificationContent {
  const strict =
    input.mode === "ghost" ||
    input.mode === "bunker" ||
    input.mode === "emergency" ||
    input.mode === "offline_capsule";
  return {
    title: strict ? "" : "FreeLayer",
    body: strict ? "" : "New activity",
    redacted: true,
    contentClass: input.contentClass,
  };
}
