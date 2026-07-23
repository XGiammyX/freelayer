/**
 * Room-local disambiguation policy (TECH-ID-06). Duplicate aliases MUST NOT be
 * shown with `alias_only`. Disambiguation NEVER exposes the private root id, a
 * phone/email/global username, or a raw internal membership id. It is NOT
 * verification. Role and assurance are always shown separately. If no safe
 * room-local member reference representation exists, we return a redaction
 * REQUIREMENT rather than inventing an identifier.
 */

import type { RoomAliasCollisionStateV1, RoomAliasDisambiguationV1 } from "./room-alias-types";

export function resolveRoomAliasDisambiguationV1(input: {
  collisionState: RoomAliasCollisionStateV1;
  /** Strict/high-risk display modes prefer redaction over any reference. */
  redactMode: boolean;
  /** Whether the caller's architecture defines a SAFE, non-authoritative,
   *  room-scoped member reference representation. Defaults to false in
   *  TECH-ID-06 (none is invented here). */
  safeRoomLocalReferenceAvailable?: boolean;
}): RoomAliasDisambiguationV1 {
  const base = {
    schemaVersion: 1 as const,
    verifiedIdentity: false as const,
    globalIdentifierExposed: false as const,
  };
  const duplicate = input.collisionState === "duplicate_in_current_room_observation";

  if (!duplicate) {
    // Unique or not evaluated: no disambiguation forced. Strict modes may still
    // redact the member reference, but alias_only is permitted when unique.
    if (input.collisionState === "not_evaluated" && input.redactMode) {
      return {
        ...base,
        required: false,
        strategy: "redacted_member_reference",
        reasonCode: "strict_mode_redacts",
      };
    }
    return {
      ...base,
      required: false,
      strategy: "alias_only",
      reasonCode: "no_duplicate_observed",
    };
  }

  if (input.redactMode) {
    return {
      ...base,
      required: true,
      strategy: "fully_redacted",
      reasonCode: "duplicate_in_strict_mode",
    };
  }
  if (input.safeRoomLocalReferenceAvailable === true) {
    return {
      ...base,
      required: true,
      strategy: "alias_plus_room_local_member_reference",
      reasonCode: "duplicate_requires_member_reference",
    };
  }
  // Duplicate but no safe reference representation exists → require redaction.
  return {
    ...base,
    required: true,
    strategy: "redacted_member_reference",
    reasonCode: "duplicate_no_safe_reference",
  };
}
