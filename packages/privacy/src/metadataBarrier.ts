/**
 * The metadata side-effect barrier (TECH-10).
 *
 * Every metadata operation must present: the concrete request, a valid
 * PolicyDecision scoped to EXACTLY that operation (authenticity via the
 * module-private WeakSet in ./index — NOT re-implemented here), and the
 * resolved MetadataPolicy. Anything less is a bypass. Default is deny.
 *
 * Errors never contain the request payload (see metadataErrors.ts).
 */

import { isPolicyDecision, type PolicyCapability, type PolicyDecision } from "./index";
import type { PolicySideEffectScope } from "./index";
import {
  ForbiddenExternalAssetMetadataError,
  ForbiddenLinkPreviewMetadataError,
  ForbiddenMetadataNetworkExposureError,
  ForbiddenMetadataPersistenceError,
  ForbiddenNotificationMetadataError,
  ForbiddenPresenceError,
  ForbiddenReceiptError,
  ForbiddenTypingIndicatorError,
  InvalidMetadataEventError,
  InvalidMetadataSinkError,
  MetadataBypassAttemptError,
  MetadataDecisionMismatchError,
  MetadataPolicyDeniedError,
} from "./metadataErrors";
import {
  assertNoSensitiveMetadataPayload,
  isKnownMetadataEvent,
  isKnownMetadataSink,
  isMetadataSinkNetworked,
  isMetadataSinkPersistent,
} from "./metadataHelpers";
import {
  AI_METADATA_EVENTS,
  DERIVED_PREVIEW_EVENTS,
  NETWORK_METADATA_EVENTS,
  type MetadataEventKind,
  type MetadataOperationRequest,
  type MetadataPolicy,
  type MetadataSink,
} from "./metadataTypes";

/** The exact side-effect scope a decision for this (event, sink) must carry. */
export function expectedMetadataScope(
  event: MetadataEventKind,
  sink: MetadataSink,
): PolicySideEffectScope {
  if (event.startsWith("receipt.")) return "receipt.emit";
  if (event.startsWith("typing.")) return "typing.emit";
  if (event.startsWith("presence.") || event === "room.activity") return "presence.emit";
  if (event.startsWith("notification.")) return "notification.show";
  if (event === "link.preview") return "link.preview";
  if (event === "asset.remote_fetch" || event === "avatar.remote_fetch") return "asset.fetch";
  if (event === "log.write" || event === "crash_report.create") return "metadata.log";
  if (event === "audit_event.write") return "metadata.audit";
  if (event === "external.navigation" || NETWORK_METADATA_EVENTS.includes(event)) {
    return "metadata.network_expose";
  }
  if (isMetadataSinkNetworked(sink)) return "metadata.network_expose";
  if (isMetadataSinkPersistent(sink)) return "metadata.store";
  if (sink === "notification_system") return "notification.show";
  return "metadata.emit";
}

/** The capability a decision for this event must have been issued against. */
export function expectedMetadataCapability(event: MetadataEventKind): PolicyCapability {
  if (event.startsWith("receipt.")) return "readReceipts";
  if (event.startsWith("typing.")) return "typingIndicators";
  if (event.startsWith("presence.") || event === "room.activity") return "presence";
  if (event.startsWith("notification.")) return "notifications";
  if (event === "link.preview") return "linkPreviews";
  if (event === "asset.remote_fetch" || event === "avatar.remote_fetch") return "externalAssets";
  if (AI_METADATA_EVENTS.includes(event)) return "localAI";
  if (DERIVED_PREVIEW_EVENTS.includes(event)) return "mediaCache";
  if (NETWORK_METADATA_EVENTS.includes(event) || event === "external.navigation") return "network";
  return "persistence";
}

/** Map a denied event to the most specific error type (falls back to generic). */
function policyDeniedError(request: MetadataOperationRequest, detail: string): Error {
  const ctx = { event: request.event, sink: request.sink, detail };
  if (request.event.startsWith("receipt.")) return new ForbiddenReceiptError(ctx);
  if (request.event.startsWith("typing.")) return new ForbiddenTypingIndicatorError(ctx);
  if (request.event.startsWith("presence.") || request.event === "room.activity") {
    return new ForbiddenPresenceError(ctx);
  }
  if (request.event.startsWith("notification.")) return new ForbiddenNotificationMetadataError(ctx);
  if (request.event === "link.preview") return new ForbiddenLinkPreviewMetadataError(ctx);
  if (request.event === "asset.remote_fetch" || request.event === "avatar.remote_fetch") {
    return new ForbiddenExternalAssetMetadataError(ctx);
  }
  return new MetadataPolicyDeniedError(ctx);
}

/**
 * Reject any metadata operation that is not authentically policy-approved and
 * scoped to exactly this event/sink. Throws; returns void on success.
 */
export function assertMetadataOperationAllowed(
  request: MetadataOperationRequest,
  decision: PolicyDecision,
  policy: MetadataPolicy,
): void {
  // ---- Request validity (fail closed) ----
  if (!isKnownMetadataEvent(request.event)) {
    throw new InvalidMetadataEventError();
  }
  if (!isKnownMetadataSink(request.sink)) {
    throw new InvalidMetadataSinkError();
  }

  // ---- The resolved policy must describe THIS request ----
  if (policy.event !== request.event || policy.sink !== request.sink) {
    throw new MetadataBypassAttemptError("policy does not match the request event/sink");
  }

  // ---- Decision authenticity + integrity (uses the WeakSet in ./index) ----
  if (!isPolicyDecision(decision)) {
    throw new MetadataBypassAttemptError(
      "operation invoked without a valid PolicyDecision (ADR-0002)",
    );
  }
  if (decision.verdict !== "allowed") {
    throw new MetadataPolicyDeniedError({
      event: request.event,
      sink: request.sink,
      detail: "policy decision verdict is denied",
    });
  }
  const capability = expectedMetadataCapability(request.event);
  if (decision.capability !== capability) {
    throw new MetadataDecisionMismatchError(
      `decision capability "${decision.capability}" does not match required "${capability}"`,
    );
  }
  const scope = expectedMetadataScope(request.event, request.sink);
  if (decision.sideEffect !== scope) {
    throw new MetadataDecisionMismatchError(
      `decision side-effect "${decision.sideEffect}" does not match "${scope}"`,
    );
  }

  // ---- Policy verdict ----
  if (!policy.allowed) {
    throw policyDeniedError(request, policy.reason);
  }

  // ---- Sink gates ----
  if (isMetadataSinkPersistent(request.sink) && !policy.persistentAllowed) {
    throw new ForbiddenMetadataPersistenceError({
      event: request.event,
      sink: request.sink,
      detail: "persistent metadata is not allowed by the active policy",
    });
  }
  if (isMetadataSinkNetworked(request.sink) && !policy.networkAllowed) {
    throw new ForbiddenMetadataNetworkExposureError({
      event: request.event,
      sink: request.sink,
      detail: "network-exposed metadata is not allowed by the active policy",
    });
  }

  // ---- Payload hygiene: no content/identifiers/sentinels in metadata ----
  assertNoSensitiveMetadataPayload(request.payload);
}
