/**
 * Room-local collision + cross-room reuse assessment (TECH-ID-06). Both are
 * PRIVACY diagnostics only. They NEVER expose a member/room graph, an exact
 * count, or colliding member ids; they NEVER merge members, alter membership or
 * trust, or emit telemetry. Duplicate aliases are allowed (they require
 * disambiguation, not denial). A unique value proves neither identity nor safety
 * nor unlinkability; a duplicate proves no impersonation. Strict modes may skip
 * evaluation. No collision index or reuse index is ever persisted.
 */

import type { ContactAliasDisplayText } from "../aliases";
import type { RoomLocalIdRef } from "../identifiers";
import type {
  RoomAliasCollisionAssessmentV1,
  RoomAliasObservationV1,
  RoomAliasReuseAssessmentV1,
  RoomAliasStateV1,
} from "./room-alias-types";

/**
 * Assess whether the target normalized value duplicates another CURRENT room
 * member's alias. `evaluate:false` (strict modes) returns `not_evaluated`. Uses a
 * single local normalized-value set for one call (no persistence, no O(N^2)).
 */
export function assessRoomAliasCollisionV1(input: {
  observations: readonly RoomAliasObservationV1[];
  normalizedValue: ContactAliasDisplayText;
  forMembershipId: string;
  evaluate?: boolean;
}): RoomAliasCollisionAssessmentV1 {
  const base = {
    schemaVersion: 1 as const,
    exactCollisionCountExposed: false as const,
    collidingMemberIdsExposed: false as const,
    impersonationProven: false as const,
  };
  if (input.evaluate === false) {
    return { ...base, state: "not_evaluated", reasonCode: "assessment_skipped_strict_mode" };
  }
  const others = new Set<string>();
  for (const o of input.observations) {
    // Fail-closed exclusion: only active/suspended CURRENT members with a
    // present normalized alias, and never the target member itself.
    if (o.membershipState === "removed_tombstone") continue;
    if (o.normalizedAlias === undefined) continue;
    if ((o.membershipId as string) === input.forMembershipId) continue;
    others.add(o.normalizedAlias as string);
  }
  const duplicate = others.has(input.normalizedValue as string);
  return {
    ...base,
    state: duplicate
      ? "duplicate_in_current_room_observation"
      : "unique_in_current_room_observation",
    reasonCode: duplicate ? "duplicate_display_value" : "unique_display_value_in_observation",
  };
}

/**
 * Assess whether the same normalized value is already an ACTIVE alias in a
 * DIFFERENT room. A local correlation WARNING only — no room ids/counts exposed.
 * `evaluate:false` returns `not_evaluated`.
 */
export function assessRoomAliasReuseV1(input: {
  state: RoomAliasStateV1;
  normalizedValue: ContactAliasDisplayText;
  forRoomId: RoomLocalIdRef;
  evaluate?: boolean;
}): RoomAliasReuseAssessmentV1 {
  const base = {
    schemaVersion: 1 as const,
    affectedRoomCountExposed: false as const,
    affectedRoomIdsExposed: false as const,
    unlinkabilityGuaranteed: false as const,
  };
  if (input.evaluate === false) {
    return {
      ...base,
      normalizedValueReusedAcrossRooms: false,
      correlationRisk: "not_evaluated",
      reasonCode: "assessment_skipped_strict_mode",
    };
  }
  const reused = input.state.presentationAliases.some(
    (a) =>
      a.lifecycle === "active_local_unshared" &&
      (a.roomId as string) !== (input.forRoomId as string) &&
      a.displayText.normalizedValue === input.normalizedValue,
  );
  return {
    ...base,
    normalizedValueReusedAcrossRooms: reused,
    correlationRisk: reused ? "display_value_reused" : "none_detected_locally",
    reasonCode: reused
      ? "display_value_reused_across_rooms"
      : "unique_normalized_value_across_local_rooms",
  };
}
