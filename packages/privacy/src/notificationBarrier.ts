/**
 * The notification side-effect barrier (TECH-12).
 *
 * Every notification operation must present an authentic PolicyDecision scoped
 * to exactly that operation (via the module-private WeakSet in ./index — NOT
 * re-implemented) and a resolved NotificationPolicy. Default deny; errors never
 * contain the payload/title/body (see notificationErrors.ts).
 */

import { isPolicyDecision, type PolicyCapability, type PolicyDecision } from "./index";
import type { PolicySideEffectScope } from "./index";
import { assertNoSensitiveMetadataPayload } from "./metadataHelpers";
import {
  ForbiddenNotificationBadgeError,
  ForbiddenNotificationContentError,
  ForbiddenNotificationNetworkError,
  ForbiddenNotificationPermissionRequestError,
  ForbiddenNotificationPersistenceError,
  ForbiddenNotificationSoundError,
  ForbiddenNotificationVibrationError,
  ForbiddenPushNotificationError,
  ForbiddenServiceWorkerNotificationError,
  NotificationBypassAttemptError,
  NotificationDecisionMismatchError,
  NotificationPolicyDeniedError,
} from "./notificationErrors";
import {
  NOTIFICATION_CONTENT_CLASSES,
  NOTIFICATION_OPERATION_KINDS,
  NOTIFICATION_SURFACES,
  SENSITIVE_CONTENT_CLASSES,
  type NotificationOperationKind,
  type NotificationOperationRequest,
  type NotificationPolicy,
} from "./notificationTypes";

/** The exact side-effect scope a decision for this operation must carry. */
export function expectedNotificationScope(
  operation: NotificationOperationKind,
): PolicySideEffectScope {
  switch (operation) {
    case "notification.permission_request":
      return "notification.permission_request";
    case "notification.badge":
      return "notification.badge";
    case "notification.sound":
      return "notification.sound";
    case "notification.vibration":
      return "notification.vibration";
    case "notification.push_subscribe":
      return "notification.push_subscribe";
    case "notification.push_receive":
      return "notification.push_receive";
    case "notification.service_worker_show":
      return "notification.service_worker_show";
    default:
      // show / preview / channel_create / group / clear / unknown
      return "notification.show";
  }
}

/** Notification decisions are always issued against the `notifications` capability. */
export const NOTIFICATION_CAPABILITY: PolicyCapability = "notifications";

function knownRequest(request: NotificationOperationRequest): boolean {
  return (
    request.operation !== "notification.unknown" &&
    request.contentClass !== "unknown" &&
    request.surface !== "unknown" &&
    NOTIFICATION_OPERATION_KINDS.includes(request.operation) &&
    NOTIFICATION_CONTENT_CLASSES.includes(request.contentClass) &&
    NOTIFICATION_SURFACES.includes(request.surface)
  );
}

function policyDeniedError(request: NotificationOperationRequest, detail: string): Error {
  const ctx = { operation: request.operation, surface: request.surface, detail };
  switch (request.operation) {
    case "notification.permission_request":
      return new ForbiddenNotificationPermissionRequestError(ctx);
    case "notification.badge":
      return new ForbiddenNotificationBadgeError(ctx);
    case "notification.sound":
      return new ForbiddenNotificationSoundError(ctx);
    case "notification.vibration":
      return new ForbiddenNotificationVibrationError(ctx);
    case "notification.push_subscribe":
    case "notification.push_receive":
      return new ForbiddenPushNotificationError(ctx);
    case "notification.service_worker_show":
      return new ForbiddenServiceWorkerNotificationError(ctx);
    default:
      if (SENSITIVE_CONTENT_CLASSES.includes(request.contentClass)) {
        return new ForbiddenNotificationContentError({
          ...ctx,
          contentClass: request.contentClass,
        });
      }
      return new NotificationPolicyDeniedError(ctx);
  }
}

export function assertNotificationOperationAllowed(
  request: NotificationOperationRequest,
  decision: PolicyDecision,
  policy: NotificationPolicy,
): void {
  // ---- Request validity (fail closed) ----
  if (!knownRequest(request)) {
    throw new NotificationBypassAttemptError("unknown operation/content class/surface");
  }

  // ---- Policy must describe THIS request ----
  if (
    policy.operation !== request.operation ||
    policy.contentClass !== request.contentClass ||
    policy.surface !== request.surface
  ) {
    throw new NotificationBypassAttemptError("policy does not match the request");
  }

  // ---- Decision authenticity + integrity (WeakSet provenance in ./index) ----
  if (!isPolicyDecision(decision)) {
    throw new NotificationBypassAttemptError(
      "operation invoked without a valid PolicyDecision (ADR-0002)",
    );
  }
  if (decision.verdict !== "allowed") {
    throw new NotificationPolicyDeniedError({
      operation: request.operation,
      surface: request.surface,
      detail: "policy decision verdict is denied",
    });
  }
  if (decision.capability !== NOTIFICATION_CAPABILITY) {
    throw new NotificationDecisionMismatchError(
      `decision capability "${decision.capability}" does not match required "${NOTIFICATION_CAPABILITY}"`,
    );
  }
  const scope = expectedNotificationScope(request.operation);
  if (decision.sideEffect !== scope) {
    throw new NotificationDecisionMismatchError(
      `decision side-effect "${decision.sideEffect}" does not match "${scope}"`,
    );
  }

  // ---- Policy verdict + per-capability gates ----
  if (!policy.allowed) {
    throw policyDeniedError(request, policy.reason);
  }
  if (request.operation === "notification.permission_request" && !policy.permissionRequestAllowed) {
    throw new ForbiddenNotificationPermissionRequestError({
      operation: request.operation,
      surface: request.surface,
      detail: "permission request not allowed",
    });
  }
  if (
    (request.operation === "notification.push_subscribe" ||
      request.operation === "notification.push_receive") &&
    !policy.pushAllowed
  ) {
    throw new ForbiddenPushNotificationError({
      operation: request.operation,
      surface: request.surface,
      detail: "push not allowed",
    });
  }
  if (request.operation === "notification.badge" && !policy.badgeAllowed) {
    throw new ForbiddenNotificationBadgeError({
      operation: request.operation,
      surface: request.surface,
      detail: "badge not allowed",
    });
  }
  if (SENSITIVE_CONTENT_CLASSES.includes(request.contentClass) && !policy.contentAllowed) {
    throw new ForbiddenNotificationContentError({
      operation: request.operation,
      surface: request.surface,
      detail: "content not allowed",
      contentClass: request.contentClass,
    });
  }
  if (!policy.persistentStorageAllowed && request.surface === "notification_center") {
    throw new ForbiddenNotificationPersistenceError({
      operation: request.operation,
      surface: request.surface,
      detail: "notification persistence not allowed",
    });
  }
  if (!policy.networkAllowed && request.surface === "push_service") {
    throw new ForbiddenNotificationNetworkError({
      operation: request.operation,
      surface: request.surface,
      detail: "notification network exposure not allowed",
    });
  }

  // ---- Payload hygiene: no titles/bodies/identifiers in the payload ----
  assertNoSensitiveMetadataPayload(request.payload);
}
