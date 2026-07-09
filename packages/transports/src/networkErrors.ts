/**
 * Network error taxonomy (TECH-08).
 *
 * REDACTION RULE: no error here may contain a full endpoint, query string,
 * credentials, or any sentinel — only operation names, transport classes,
 * modes, and policy reasons. Enforced by construction and tested.
 */

import type { NetworkOperationKind } from "./networkTypes";

interface NetworkErrorContext {
  readonly operation: NetworkOperationKind;
  readonly detail: string;
}

const describe = (ctx: NetworkErrorContext): string =>
  `network operation "${ctx.operation}" rejected: ${ctx.detail}`;

/** The resolved NetworkPolicy denies this operation. */
export class NetworkPolicyDeniedError extends Error {
  override readonly name = "NetworkPolicyDeniedError";
  constructor(ctx: NetworkErrorContext) {
    super(describe(ctx));
  }
}

/** The call tried to skip the barrier: missing/invalid decision, mismatch. */
export class NetworkBypassAttemptError extends Error {
  override readonly name = "NetworkBypassAttemptError";
  constructor(detail: string) {
    super(`Network bypass attempt rejected: ${detail}`);
  }
}

/** The operation kind is forbidden outright in this mode. */
export class ForbiddenNetworkOperationError extends Error {
  override readonly name = "ForbiddenNetworkOperationError";
  constructor(ctx: NetworkErrorContext) {
    super(describe(ctx));
  }
}

/** Telemetry-shaped operations are always denied (ADR-0008). */
export class ForbiddenTelemetryError extends Error {
  override readonly name = "ForbiddenTelemetryError";
  constructor() {
    super("Telemetry network operations are forbidden.");
  }
}

/** External asset fetches are denied (ADR-0008, NO_EXTERNAL_ASSETS_POLICY). */
export class ForbiddenExternalAssetError extends Error {
  override readonly name = "ForbiddenExternalAssetError";
  constructor() {
    super("External asset fetches are forbidden.");
  }
}

/** Automatic link previews are denied in all modes. */
export class ForbiddenLinkPreviewError extends Error {
  override readonly name = "ForbiddenLinkPreviewError";
  constructor() {
    super("Automatic link previews are forbidden.");
  }
}

/** Direct peer connections (WebRTC) are denied in Private/Ghost/Bunker. */
export class ForbiddenDirectPeerConnectionError extends Error {
  override readonly name = "ForbiddenDirectPeerConnectionError";
  constructor() {
    super("Direct peer connections are forbidden by the active policy.");
  }
}

/** Any network under Offline Capsule (or normal network under Emergency). */
export class ForbiddenOfflineModeNetworkError extends Error {
  override readonly name = "ForbiddenOfflineModeNetworkError";
  constructor(detail: string) {
    super(`Network operation forbidden in this mode: ${detail}`);
  }
}

/** The endpoint failed validation. Generic — never echoes the endpoint. */
export class InvalidNetworkEndpointError extends Error {
  override readonly name = "InvalidNetworkEndpointError";
  constructor() {
    super("Invalid network endpoint.");
  }
}

/** The decision exists but was issued for a different capability/side effect. */
export class NetworkDecisionMismatchError extends Error {
  override readonly name = "NetworkDecisionMismatchError";
  constructor(detail: string) {
    super(`Network decision mismatch: ${detail}`);
  }
}
