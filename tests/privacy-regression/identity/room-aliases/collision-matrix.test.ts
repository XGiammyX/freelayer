/**
 * Privacy-regression (TECH-ID-06 §31): room-local collision + disambiguation
 * matrix. Table-driven over alias A × alias B × normalization equivalence ×
 * membership lifecycle × evaluate flag. Proves: identical / canonically-
 * equivalent values collide; case-different and visually-confusable-but-distinct
 * values do NOT (no case fold, no confusable detection); left members and
 * malformed observations are excluded fail-closed; strict mode skips evaluation;
 * duplicates never use alias_only and never expose a global/root identifier.
 * Every non-ASCII code point is a \u escape (no invisible chars in source).
 */
import { describe, expect, it } from "vitest";
import {
  assessRoomAliasCollisionV1,
  normalizeContactAliasDisplayTextV1,
  resolveRoomAliasDisambiguationV1,
  type RoomAliasObservationV1,
  type RoomOsMembershipStateV1,
} from "@freelayer/identity";
import { MEMBER, ref } from "../../../fixtures/room-aliases/v1/helpers";

const norm = (s: string) => normalizeContactAliasDisplayTextV1(s).normalizedValue;
function obs(
  membershipId: string,
  alias: string | undefined,
  state: RoomOsMembershipStateV1 = "active_local_unverified",
): RoomAliasObservationV1 {
  return {
    roomId: ref().roomId,
    membershipId: membershipId as never,
    ...(alias !== undefined ? { normalizedAlias: norm(alias) } : {}),
    membershipState: state,
  };
}

// label, targetAlias, otherObservation, evaluate, expected collision state
type Row = readonly [string, string, RoomAliasObservationV1, boolean, string];
const ROWS: readonly Row[] = [
  [
    "identical normalized",
    "Blue Fox",
    obs("member-2", "Blue Fox"),
    true,
    "duplicate_in_current_room_observation",
  ],
  // Canonically equivalent (precomposed vs decomposed) collide after NFC.
  [
    "canonically equivalent",
    "\u00e9",
    obs("member-2", "e\u0301"),
    true,
    "duplicate_in_current_room_observation",
  ],
  // Case-different: NO case folding → distinct values → unique.
  [
    "case-different (no fold)",
    "BLUE FOX",
    obs("member-2", "blue fox"),
    true,
    "unique_in_current_room_observation",
  ],
  // Visually confusable but distinct code points (Cyrillic vs Latin) → unique.
  [
    "confusable but distinct",
    "Alice",
    obs("member-2", "Аlice"),
    true,
    "unique_in_current_room_observation",
  ],
  // The other member has left → excluded → unique.
  [
    "member left",
    "Blue Fox",
    obs("member-2", "Blue Fox", "removed_tombstone"),
    true,
    "unique_in_current_room_observation",
  ],
  // Malformed observation (no alias) → excluded → unique.
  [
    "malformed observation",
    "Blue Fox",
    obs("member-2", undefined),
    true,
    "unique_in_current_room_observation",
  ],
  // Strict mode → not evaluated even when a duplicate exists.
  ["strict skips evaluation", "Blue Fox", obs("member-2", "Blue Fox"), false, "not_evaluated"],
];

describe("Collision matrix", () => {
  it.each(ROWS)("%s", (_label, target, other, evaluate, expected) => {
    const a = assessRoomAliasCollisionV1({
      observations: [other],
      normalizedValue: norm(target),
      forMembershipId: MEMBER,
      evaluate,
    });
    expect(a.state).toBe(expected);
    expect(a.collidingMemberIdsExposed).toBe(false);
    expect(a.exactCollisionCountExposed).toBe(false);
    expect(a.impersonationProven).toBe(false);
  });

  it("the target member never collides with itself", () => {
    const a = assessRoomAliasCollisionV1({
      observations: [obs(MEMBER, "Blue Fox")],
      normalizedValue: norm("Blue Fox"),
      forMembershipId: MEMBER,
    });
    expect(a.state).toBe("unique_in_current_room_observation");
  });
});

describe("Disambiguation follows collision + mode", () => {
  it("duplicate → never alias_only; strict → fully redacted; unique → alias_only", () => {
    const dup = resolveRoomAliasDisambiguationV1({
      collisionState: "duplicate_in_current_room_observation",
      redactMode: false,
    });
    expect(dup.required).toBe(true);
    expect(dup.strategy).not.toBe("alias_only");
    expect(dup.globalIdentifierExposed).toBe(false);
    expect(dup.verifiedIdentity).toBe(false);
    expect(
      resolveRoomAliasDisambiguationV1({
        collisionState: "duplicate_in_current_room_observation",
        redactMode: true,
      }).strategy,
    ).toBe("fully_redacted");
    // With a safe room-local reference available, duplicates may append it.
    expect(
      resolveRoomAliasDisambiguationV1({
        collisionState: "duplicate_in_current_room_observation",
        redactMode: false,
        safeRoomLocalReferenceAvailable: true,
      }).strategy,
    ).toBe("alias_plus_room_local_member_reference");
    expect(
      resolveRoomAliasDisambiguationV1({
        collisionState: "unique_in_current_room_observation",
        redactMode: false,
      }).strategy,
    ).toBe("alias_only");
  });
});
