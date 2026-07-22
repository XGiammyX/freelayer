/**
 * Opaque LOCAL identity identifiers + revision/schema primitives (TECH-ID-03).
 *
 * These identifiers are LOCAL, OPAQUE references: they encode NO email/phone/
 * username/display name, NO timestamp-as-claim, NO key material, NO device
 * model, NO room title, and NO globally discoverable meaning. An id grants NO
 * authority, proves NO identity, and implies NO cryptographic randomness or
 * authenticity (Gate F owns crypto). They are internal references, NOT
 * user-facing aliases, and this module is NOT a hostile-input parser (Gate E).
 *
 * To avoid a circular dependency with RoomOS, room references used by identity
 * bindings are NARROW identity-local brands (`RoomLocalIdRef`,
 * `RoomMembershipIdRef`); RoomOS maps its own ids to these at the boundary.
 */

import type { Brand } from "@freelayer/security";
import { IdentityIdentifierError } from "./identity-errors";

// ---------------------------------------------------------------------------
// Branded opaque local identity ids
// ---------------------------------------------------------------------------

export type LocalIdentityRootId = string & { readonly __localIdentityRootId: unique symbol };
export type IdentityPersonaId = string & { readonly __identityPersonaId: unique symbol };
export type PairwiseRelationshipId = string & {
  readonly __pairwiseRelationshipId: unique symbol;
};
export type RoomIdentityBindingId = string & { readonly __roomIdentityBindingId: unique symbol };
export type IdentityVaultId = string & { readonly __identityVaultId: unique symbol };

/** Future-reference ids (Gate F/G) — declared for the contract, never key material. */
export type DeviceAuthorizationRef = string & { readonly __deviceAuthorizationRef: unique symbol };
export type TrustNotebookRef = string & { readonly __trustNotebookRef: unique symbol };
export type RecoveryConfigurationRef = string & {
  readonly __recoveryConfigurationRef: unique symbol;
};

/** Narrow, identity-local references to RoomOS ids (avoids circular dependency). */
export type RoomLocalIdRef = Brand<string, "RoomLocalIdRef">;
export type RoomMembershipIdRef = Brand<string, "RoomMembershipIdRef">;

// ---------------------------------------------------------------------------
// Schema + local revision
// ---------------------------------------------------------------------------

export type IdentitySchemaVersion = 1;
export const IDENTITY_SCHEMA_VERSION = 1 as const;

/**
 * A POSITIVE LOCAL optimistic-concurrency counter. Increments by one per
 * accepted local mutation. NOT a timestamp, NOT a global version, NOT a vector
 * clock, NOT tamper resistance, NOT synchronization, NOT cryptographic continuity.
 */
export type IdentityLocalRevision = number & { readonly __identityLocalRevision: unique symbol };

export const FIRST_IDENTITY_REVISION = 1 as IdentityLocalRevision;
export const MAX_IDENTITY_REVISION = Number.MAX_SAFE_INTEGER - 1;

export function validateIdentityLocalRevision(input: number): IdentityLocalRevision {
  if (
    typeof input !== "number" ||
    !Number.isSafeInteger(input) ||
    input < 1 ||
    input > MAX_IDENTITY_REVISION
  ) {
    throw new IdentityIdentifierError("invalid_revision");
  }
  return input as IdentityLocalRevision;
}

export function nextIdentityRevision(current: IdentityLocalRevision): IdentityLocalRevision {
  const next = (current as number) + 1;
  if (next > MAX_IDENTITY_REVISION) {
    throw new IdentityIdentifierError("revision_overflow");
  }
  return next as IdentityLocalRevision;
}

// ---------------------------------------------------------------------------
// Validation — conservative, ASCII-safe, bounded, prefix-tagged
// ---------------------------------------------------------------------------

// Opaque local id: a class prefix + ASCII-safe body. No whitespace, control
// chars, path separators, url schemes, query strings, `@`, or `+` (email/phone
// shapes). Bounded length. NOT a display alias.
const ID_BODY_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

function isEmailLike(input: string): boolean {
  return input.includes("@");
}
function isPhoneLike(input: string): boolean {
  // A run of digits/spaces/dashes/parens with a leading + or >= 7 digits.
  const digits = input.replace(/\D/g, "");
  return /^\+/.test(input) || digits.length >= 7;
}
function isUrlLike(input: string): boolean {
  return (
    input.includes("://") ||
    input.includes("?") ||
    input.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/.test(input)
  );
}

function validateOpaqueId(input: unknown, prefix: string): string {
  if (typeof input !== "string") throw new IdentityIdentifierError("not_a_string");
  if (input.length < 4 || input.length > 128) throw new IdentityIdentifierError("bad_length");
  if (!input.startsWith(`${prefix}-`)) throw new IdentityIdentifierError("bad_prefix");
  if (!ID_BODY_RE.test(input)) throw new IdentityIdentifierError("bad_format");
  if (isEmailLike(input)) throw new IdentityIdentifierError("email_like");
  if (isPhoneLike(input)) throw new IdentityIdentifierError("phone_like");
  if (isUrlLike(input)) throw new IdentityIdentifierError("url_or_path_like");
  if (/[\\/]/.test(input)) throw new IdentityIdentifierError("path_like");
  return input;
}

export function validateLocalIdentityRootId(input: string): LocalIdentityRootId {
  return validateOpaqueId(input, "idr") as LocalIdentityRootId;
}
export function validateIdentityPersonaId(input: string): IdentityPersonaId {
  return validateOpaqueId(input, "idp") as IdentityPersonaId;
}
export function validatePairwiseRelationshipId(input: string): PairwiseRelationshipId {
  return validateOpaqueId(input, "idrel") as PairwiseRelationshipId;
}
export function validateRoomIdentityBindingId(input: string): RoomIdentityBindingId {
  return validateOpaqueId(input, "idrb") as RoomIdentityBindingId;
}
export function validateIdentityVaultId(input: string): IdentityVaultId {
  return validateOpaqueId(input, "idv") as IdentityVaultId;
}
export function validateRoomLocalIdRef(input: string): RoomLocalIdRef {
  // A narrow room reference: same opaque-slug rule (rooms use `[a-z0-9][a-z0-9_-]`).
  if (typeof input !== "string" || !ID_BODY_RE.test(input) || isEmailLike(input)) {
    throw new IdentityIdentifierError("bad_room_ref");
  }
  return input as RoomLocalIdRef;
}
export function validateRoomMembershipIdRef(input: string): RoomMembershipIdRef {
  if (typeof input !== "string" || !ID_BODY_RE.test(input) || isEmailLike(input)) {
    throw new IdentityIdentifierError("bad_membership_ref");
  }
  return input as RoomMembershipIdRef;
}

// ---------------------------------------------------------------------------
// Injected id generation (at the creation boundary — never inside the reducer)
// ---------------------------------------------------------------------------

/**
 * Pre-generated ids passed INTO the reducer for create commands. Generation
 * happens at the boundary (never a non-deterministic call inside a reducer); the
 * reducer is deterministic given these. Only the id the command needs is consumed.
 */
export interface LocalIdentityGeneratedIdsV1 {
  readonly rootId?: LocalIdentityRootId;
  readonly personaId?: IdentityPersonaId;
  readonly relationshipId?: PairwiseRelationshipId;
  readonly bindingId?: RoomIdentityBindingId;
  readonly vaultId?: IdentityVaultId;
}

export interface LocalIdentityIdGeneratorV1 {
  nextRootId(): LocalIdentityRootId;
  nextPersonaId(): IdentityPersonaId;
  nextRelationshipId(): PairwiseRelationshipId;
  nextRoomBindingId(): RoomIdentityBindingId;
  nextVaultId(): IdentityVaultId;
}
