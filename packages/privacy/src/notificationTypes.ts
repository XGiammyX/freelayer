/**
 * Notification Privacy Model taxonomy (TECH-12). Types + constants only.
 *
 * Notifications are metadata-producing side effects and their content is
 * sensitive by default: a banner/lock-screen/notification-center entry can
 * reveal that FreeLayer is installed, that a room is active, a sender alias, or
 * a message preview — outside the app's control once delivered. So every
 * notification behavior is classified and denied by default
 * (docs/METADATA_MODEL.md, docs/audits/TECH_12_NOTIFICATION_THREAT_MODEL.md).
 *
 * NO real notifications, NO permission prompts, NO push, NO service worker.
 * This models policy before any notification feature exists.
 */

import type { PrivacyMode } from "./index";

export type NotificationOperationKind =
  | "notification.permission_request"
  | "notification.show"
  | "notification.preview"
  | "notification.badge"
  | "notification.sound"
  | "notification.vibration"
  | "notification.channel_create"
  | "notification.group"
  | "notification.clear"
  | "notification.push_subscribe"
  | "notification.push_receive"
  | "notification.service_worker_show"
  | "notification.unknown";

export const NOTIFICATION_OPERATION_KINDS: readonly NotificationOperationKind[] = [
  "notification.permission_request",
  "notification.show",
  "notification.preview",
  "notification.badge",
  "notification.sound",
  "notification.vibration",
  "notification.channel_create",
  "notification.group",
  "notification.clear",
  "notification.push_subscribe",
  "notification.push_receive",
  "notification.service_worker_show",
  "notification.unknown",
];

export type NotificationContentClass =
  | "none"
  | "generic"
  | "app_name_only"
  | "activity_count"
  | "room_activity"
  | "room_name"
  | "sender_alias"
  | "message_preview"
  | "task_title"
  | "decision_title"
  | "document_title"
  | "ai_summary"
  | "protected_content"
  | "secret"
  | "unknown";

export const NOTIFICATION_CONTENT_CLASSES: readonly NotificationContentClass[] = [
  "none",
  "generic",
  "app_name_only",
  "activity_count",
  "room_activity",
  "room_name",
  "sender_alias",
  "message_preview",
  "task_title",
  "decision_title",
  "document_title",
  "ai_summary",
  "protected_content",
  "secret",
  "unknown",
];

/** Content classes that carry sensitive/content-adjacent information. */
export const SENSITIVE_CONTENT_CLASSES: readonly NotificationContentClass[] = [
  "room_activity",
  "room_name",
  "sender_alias",
  "message_preview",
  "task_title",
  "decision_title",
  "document_title",
  "ai_summary",
  "protected_content",
  "secret",
];

/** The only content classes a generic in-app indicator may carry. */
export const GENERIC_CONTENT_CLASSES: readonly NotificationContentClass[] = [
  "none",
  "generic",
  "app_name_only",
];

export type NotificationSurface =
  | "in_app"
  | "system_banner"
  | "lock_screen"
  | "notification_center"
  | "app_badge"
  | "sound"
  | "vibration"
  | "push_service"
  | "service_worker"
  | "unknown";

export const NOTIFICATION_SURFACES: readonly NotificationSurface[] = [
  "in_app",
  "system_banner",
  "lock_screen",
  "notification_center",
  "app_badge",
  "sound",
  "vibration",
  "push_service",
  "service_worker",
  "unknown",
];

export type NotificationPrivacyAction =
  | "deny"
  | "allow_generic_only"
  | "redact"
  | "memory_only"
  | "require_user_action"
  | "future_gate"
  | "not_implemented";

export interface NotificationPolicy {
  readonly mode: PrivacyMode;
  readonly operation: NotificationOperationKind;
  readonly contentClass: NotificationContentClass;
  readonly surface: NotificationSurface;
  readonly action: NotificationPrivacyAction;
  readonly allowed: boolean;
  readonly permissionRequestAllowed: boolean;
  readonly contentAllowed: boolean;
  readonly badgeAllowed: boolean;
  readonly soundAllowed: boolean;
  readonly vibrationAllowed: boolean;
  readonly pushAllowed: boolean;
  readonly persistentStorageAllowed: boolean;
  readonly networkAllowed: boolean;
  readonly userVisibleWarningRequired: boolean;
  readonly reason: string;
}

export interface NotificationPolicyInput {
  readonly mode: PrivacyMode;
  readonly operation: NotificationOperationKind;
  readonly contentClass: NotificationContentClass;
  readonly surface: NotificationSurface;
  readonly userInitiated?: boolean;
  readonly roomPolicy?: Partial<NotificationPolicy>;
  readonly screenShieldLevel?: "off" | "standard" | "protected" | "sealed" | "bunker";
  readonly deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
}

/**
 * A concrete notification operation. `payload` is `unknown` and MUST NOT be
 * serialized, logged, thrown, or written to audit — it could carry a title,
 * body, room name, or sender alias. The barrier rejects sensitive payloads.
 */
export interface NotificationOperationRequest {
  readonly operation: NotificationOperationKind;
  readonly contentClass: NotificationContentClass;
  readonly surface: NotificationSurface;
  /** Non-sensitive justification. Never a title/body/identifier. */
  readonly reason: string;
  readonly payload?: unknown;
}

export interface NotificationDecisionContext {
  readonly request: NotificationOperationRequest;
  readonly policy: NotificationPolicy;
  readonly decision: import("./index").PolicyDecision;
}

/** The only representation of notification content permitted to leave the module. */
export interface RedactedNotificationContent {
  readonly title: string;
  readonly body: string;
  readonly redacted: true;
  readonly contentClass: NotificationContentClass;
}
