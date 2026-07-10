/**
 * Notification error taxonomy (TECH-12).
 *
 * REDACTION RULE: no error here may contain a notification title/body, room
 * name, sender alias, message text, payload, or sentinel — only the operation,
 * content class, surface, and a non-sensitive policy reason. Enforced by
 * construction (tests/security-regression/notifications).
 */

import type {
  NotificationContentClass,
  NotificationOperationKind,
  NotificationSurface,
} from "./notificationTypes";

interface NotificationErrorContext {
  readonly operation: NotificationOperationKind;
  readonly surface: NotificationSurface;
  /** Non-sensitive policy reason only. Never a title/body/identifier. */
  readonly detail: string;
}

function describe(ctx: NotificationErrorContext): string {
  return `notification "${ctx.operation}" → "${ctx.surface}" rejected: ${ctx.detail}`;
}

export class NotificationPolicyDeniedError extends Error {
  override readonly name = "NotificationPolicyDeniedError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class NotificationBypassAttemptError extends Error {
  override readonly name = "NotificationBypassAttemptError";
  constructor(detail: string) {
    super(`Notification bypass attempt rejected: ${detail}`);
  }
}

export class ForbiddenNotificationPermissionRequestError extends Error {
  override readonly name = "ForbiddenNotificationPermissionRequestError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenNotificationContentError extends Error {
  override readonly name = "ForbiddenNotificationContentError";
  constructor(ctx: NotificationErrorContext & { readonly contentClass: NotificationContentClass }) {
    super(`${describe(ctx)} (content class "${ctx.contentClass}")`);
  }
}

export class ForbiddenNotificationBadgeError extends Error {
  override readonly name = "ForbiddenNotificationBadgeError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenNotificationSoundError extends Error {
  override readonly name = "ForbiddenNotificationSoundError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenNotificationVibrationError extends Error {
  override readonly name = "ForbiddenNotificationVibrationError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenPushNotificationError extends Error {
  override readonly name = "ForbiddenPushNotificationError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenServiceWorkerNotificationError extends Error {
  override readonly name = "ForbiddenServiceWorkerNotificationError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenNotificationPersistenceError extends Error {
  override readonly name = "ForbiddenNotificationPersistenceError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenNotificationNetworkError extends Error {
  override readonly name = "ForbiddenNotificationNetworkError";
  constructor(ctx: NotificationErrorContext) {
    super(describe(ctx));
  }
}

export class NotificationDecisionMismatchError extends Error {
  override readonly name = "NotificationDecisionMismatchError";
  constructor(detail: string) {
    super(`Notification decision mismatch: ${detail}`);
  }
}
