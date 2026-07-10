/**
 * Metadata Firewall error taxonomy (TECH-10).
 *
 * REDACTION RULE (like storage errors.ts): no error here may contain a payload,
 * a room/contact/message identifier, an endpoint, a query string, or any
 * sensitive sentinel. Messages are stable and generic. Enforced by
 * construction — factories accept only event kinds, sinks and policy reasons,
 * never the request payload (tests/security-regression/metadata).
 */

import type { MetadataEventKind, MetadataSink } from "./metadataTypes";

interface MetadataErrorContext {
  readonly event: MetadataEventKind;
  readonly sink: MetadataSink;
  /** Non-sensitive policy reason only. */
  readonly detail: string;
}

function describe(ctx: MetadataErrorContext): string {
  return `metadata "${ctx.event}" → "${ctx.sink}" rejected: ${ctx.detail}`;
}

/** The resolved MetadataPolicy denies this operation. */
export class MetadataPolicyDeniedError extends Error {
  override readonly name = "MetadataPolicyDeniedError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

/** The call tried to skip the barrier: missing/invalid/mismatched decision. */
export class MetadataBypassAttemptError extends Error {
  override readonly name = "MetadataBypassAttemptError";
  constructor(detail: string) {
    super(`Metadata bypass attempt rejected: ${detail}`);
  }
}

/** A read/delivery receipt was attempted where receipts are denied. */
export class ForbiddenReceiptError extends Error {
  override readonly name = "ForbiddenReceiptError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenTypingIndicatorError extends Error {
  override readonly name = "ForbiddenTypingIndicatorError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenPresenceError extends Error {
  override readonly name = "ForbiddenPresenceError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenNotificationMetadataError extends Error {
  override readonly name = "ForbiddenNotificationMetadataError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenLinkPreviewMetadataError extends Error {
  override readonly name = "ForbiddenLinkPreviewMetadataError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

export class ForbiddenExternalAssetMetadataError extends Error {
  override readonly name = "ForbiddenExternalAssetMetadataError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

/** A persistent metadata write was attempted where persistence is not allowed. */
export class ForbiddenMetadataPersistenceError extends Error {
  override readonly name = "ForbiddenMetadataPersistenceError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

/** A network-exposing metadata emit was attempted where it is not allowed. */
export class ForbiddenMetadataNetworkExposureError extends Error {
  override readonly name = "ForbiddenMetadataNetworkExposureError";
  constructor(ctx: MetadataErrorContext) {
    super(describe(ctx));
  }
}

/** The metadata event is unknown/unsupported — fail closed. */
export class InvalidMetadataEventError extends Error {
  override readonly name = "InvalidMetadataEventError";
  constructor() {
    super("Invalid or unsupported metadata event.");
  }
}

/** The metadata sink is unknown/unsupported — fail closed. */
export class InvalidMetadataSinkError extends Error {
  override readonly name = "InvalidMetadataSinkError";
  constructor() {
    super("Invalid or unsupported metadata sink.");
  }
}

/** The PolicyDecision exists but was issued for a different side effect. */
export class MetadataDecisionMismatchError extends Error {
  override readonly name = "MetadataDecisionMismatchError";
  constructor(detail: string) {
    super(`Metadata decision mismatch: ${detail}`);
  }
}
