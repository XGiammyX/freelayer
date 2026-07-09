/**
 * The network side-effect barrier (TECH-08).
 *
 * Every network operation must present the concrete request, a PolicyDecision
 * scoped to EXACTLY that operation, and the resolved NetworkPolicy. Default is
 * deny; "generic" decisions are NOT accepted. Errors never contain endpoints.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
} from "@freelayer/privacy";
import { validateNetworkEndpoint } from "./networkEndpoint";
import {
  ForbiddenDirectPeerConnectionError,
  ForbiddenExternalAssetError,
  ForbiddenLinkPreviewError,
  ForbiddenOfflineModeNetworkError,
  ForbiddenTelemetryError,
  NetworkBypassAttemptError,
  NetworkDecisionMismatchError,
  NetworkPolicyDeniedError,
} from "./networkErrors";
import type { NetworkPolicy } from "./networkPolicy";
import { DIRECT_PEER_TRANSPORT_CLASSES, type NetworkRequest } from "./networkTypes";

/** The decision's side-effect scope must equal the operation exactly. */
function assertDecisionValid(request: NetworkRequest, decision: PolicyDecision): void {
  if (!isPolicyDecision(decision)) {
    throw new NetworkBypassAttemptError(
      "operation invoked without a valid PolicyDecision (ADR-0002)",
    );
  }
  if (decision.capability !== "network" && decision.capability !== "directTransport") {
    throw new NetworkDecisionMismatchError(
      `decision capability "${decision.capability}" is not a network capability`,
    );
  }
  if (decision.verdict !== "allowed") {
    throw new NetworkPolicyDeniedError({
      operation: request.operation,
      detail: "policy decision verdict is denied",
    });
  }
  if ((decision.sideEffect as PolicySideEffectScope) !== request.operation) {
    throw new NetworkDecisionMismatchError(
      `decision side-effect "${decision.sideEffect}" does not match operation "${request.operation}"`,
    );
  }
}

export function assertNetworkOperationAllowed(
  request: NetworkRequest,
  decision: PolicyDecision,
  policy: NetworkPolicy,
): void {
  assertDecisionValid(request, decision);

  // Category-specific hard denials with precise error types.
  if (request.operation === "telemetry.send") {
    throw new ForbiddenTelemetryError();
  }
  if (request.operation === "asset.fetch") {
    throw new ForbiddenExternalAssetError();
  }
  if (request.operation === "link.preview") {
    throw new ForbiddenLinkPreviewError();
  }
  if (
    DIRECT_PEER_TRANSPORT_CLASSES.includes(request.transportClass) &&
    !policy.allowsDirectPeerConnection
  ) {
    throw new ForbiddenDirectPeerConnectionError();
  }
  if (
    (policy.mode === "offline_capsule" || policy.mode === "emergency") &&
    policy.allowed === false
  ) {
    // Offer the specific error for offline/emergency network denial.
    if (!policy.allowed) {
      throw new ForbiddenOfflineModeNetworkError(`mode "${policy.mode}" denies network`);
    }
  }

  if (!policy.allowed) {
    throw new NetworkPolicyDeniedError({ operation: request.operation, detail: policy.reason });
  }

  if (policy.requiresUserInitiation && !request.userInitiated) {
    throw new NetworkPolicyDeniedError({
      operation: request.operation,
      detail: "operation requires explicit user initiation",
    });
  }

  // Endpoint, if present, must pass validation (and be permitted by policy).
  if (request.endpoint !== undefined) {
    if (!policy.allowsExternalEndpoint) {
      throw new NetworkPolicyDeniedError({
        operation: request.operation,
        detail: "external endpoints are not permitted by the active policy",
      });
    }
    validateNetworkEndpoint(request.endpoint); // throws InvalidNetworkEndpointError, redacted
  }
}
