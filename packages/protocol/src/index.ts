/**
 * @freelayer/protocol — wire format placeholders. NO PARSER, NO SERIALIZATION.
 *
 * The capsule wire format is blocked by Gate E (docs/IMPLEMENTATION_GATES.md,
 * docs/CAPSULENET.md — "Capsule wire format gates"). Everything here is a
 * type-level draft so other packages can reference shapes without locking a
 * format.
 *
 * Standing rules for whoever implements this later:
 * - ALL parsers in this package are hostile-input parsers (docs/CAPSULENET.md):
 *   strict schemas, explicit size limits, explicit recursion/depth limits,
 *   quarantine on failure, fuzz tests before production use.
 * - No parser implementation yet. No padding implementation yet. No relay
 *   addressing yet.
 */

declare const brandSymbol: unique symbol;
type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

/** Protocol version identifier — every wire artifact carries one. */
export type ProtocolVersion = Brand<number, "ProtocolVersion">;

/** Draft pre-release version. The real v1 arrives with the wire format (Gate E). */
export const PROTOCOL_VERSION_DRAFT = 0 as ProtocolVersion;

/**
 * Capsule identifier.
 *
 * Provisional v1 direction (Prompt 03 decision): capsule IDs are RANDOM, not
 * content-derived — content-derived IDs increase correlation risk across
 * contexts. Deduplication uses random ID + replay cache. ID *generation* is
 * not implemented here; it depends on reviewed randomness (Gate F) and the
 * wire format design (Gate E).
 */
export type CapsuleId = Brand<string, "CapsuleId">;

/**
 * Padding profile placeholder. Final bucket sizes require metadata research
 * (docs/METADATA_MODEL.md — padding TODO). No padding is implemented.
 */
export type PaddingProfile = "none" | "small" | "medium" | "large" | "fixed_profile_todo";

/**
 * DRAFT envelope shape — NOT a wire format. Field set, encoding, and header
 * minimization are all Gate E design work; the crypto envelope assumptions
 * must additionally pass review (Gate F). The envelope deliberately carries
 * no plaintext sender, recipient, room, or content-type information
 * (docs/CAPSULENET.md).
 */
export interface CapsuleEnvelopeDraft {
  readonly version: ProtocolVersion;
  /** Algorithm identifier string — crypto agility (ADR-0004). Placeholder type. */
  readonly algorithmIdPlaceholder: string;
  /** Opaque routing hint; meaningful only to the recipient's pickup flow. */
  readonly routingHint: Uint8Array;
  /** Sealed, padded payload. Opaque to every transport (ADR-0003). */
  readonly sealedPayload: Uint8Array;
  readonly paddingProfile: PaddingProfile;
}
