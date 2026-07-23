/**
 * Safe room-member display context + redacted audit (TECH-ID-06). The display
 * context returns role / membership state / identity assurance SEPARATELY from
 * alias text, never a generic "verified member" flag, and never derives
 * authority from the alias. Duplicate aliases force a safe disambiguation
 * strategy. Strict modes omit ids + alias text. A read requires its OWN
 * `identity.room_alias.display_context.read` decision. Security-sensitive callers
 * must NEVER use a room alias as the sole identity signal for role changes,
 * membership removal, verification, recovery, device linking, export, or
 * destructive actions.
 */

import { isPolicyDecision, type PolicyDecision, type PrivacyMode } from "@freelayer/privacy";
import { RoomAliasDecisionMismatchError } from "./room-alias-errors";
import { assessRoomAliasCollisionV1 } from "./room-alias-collision";
import { resolveRoomAliasDisambiguationV1 } from "./room-alias-disambiguation";
import type { RoomAliasBindingStateV1 } from "../identity-types";
import type { RoomAliasPolicyV1 } from "./room-alias-policy";
import type {
  RoomAliasBindingRefV1,
  RoomAliasCollisionStateV1,
  RoomAliasObservationV1,
  RoomAliasStateV1,
  RoomMemberDisplayContextV1,
  RoomOsMembershipRoleV1,
  RoomOsMembershipStateV1,
} from "./room-alias-types";

export type RoomAliasAuditCategoryV1 =
  "room_alias_lifecycle" | "room_alias_display_context" | "room_alias_collision_assessment";

export interface RoomAliasAuditEventV1 {
  readonly schemaVersion: 1;
  readonly operationCategory: RoomAliasAuditCategoryV1;
  readonly outcome: "allowed" | "denied";
  readonly mode: PrivacyMode;
  readonly reasonCode: string;
  readonly redacted: true;
}

export function buildRoomAliasAuditEventV1(input: {
  operationCategory: RoomAliasAuditCategoryV1;
  outcome: "allowed" | "denied";
  mode: PrivacyMode;
  reasonCode: string;
}): RoomAliasAuditEventV1 {
  return { schemaVersion: 1, ...input, redacted: true };
}

export function assertRoomAliasDisplayDecisionV1(decision: PolicyDecision): void {
  if (
    !isPolicyDecision(decision) ||
    decision.verdict !== "allowed" ||
    decision.sideEffect !== "identity.room_alias.display_context.read"
  ) {
    throw new RoomAliasDecisionMismatchError();
  }
}

/** Derived hint for RoomIdentityBindingV1.roomAliasState. Alias records remain
 *  authoritative; this is a convenience, never authority. */
export function deriveRoomAliasBindingStateV1(
  state: RoomAliasStateV1,
  bindingId: string,
): RoomAliasBindingStateV1 {
  const forBinding = state.presentationAliases.filter((a) => (a.bindingId as string) === bindingId);
  if (forBinding.some((a) => a.lifecycle !== "retired_tombstone")) return "local_alias_v1";
  if (forBinding.length > 0) return "retired";
  return "none";
}

export function buildRoomMemberDisplayContextV1(input: {
  ref: RoomAliasBindingRefV1;
  /** Authoritative RoomOS membership snapshot (role + state) supplied by caller. */
  member: { role: RoomOsMembershipRoleV1; state: RoomOsMembershipStateV1 };
  state: RoomAliasStateV1;
  observations: readonly RoomAliasObservationV1[];
  policy: RoomAliasPolicyV1;
  safeRoomLocalReferenceAvailable?: boolean;
}): RoomMemberDisplayContextV1 {
  const { ref, member, state, observations, policy } = input;
  const alias = state.presentationAliases.find(
    (a) =>
      (a.bindingId as string) === (ref.bindingId as string) &&
      a.lifecycle === "active_local_unshared",
  );

  // Strict / minimizing modes redact ids and alias text.
  const redacted = !policy.exactTimestampsAllowed;

  let collisionState: RoomAliasCollisionStateV1 = "not_evaluated";
  if (alias !== undefined && ref.membershipId !== undefined) {
    collisionState = assessRoomAliasCollisionV1({
      observations,
      normalizedValue: alias.displayText.normalizedValue,
      forMembershipId: ref.membershipId as string,
      evaluate: policy.collisionAssessmentAllowed,
    }).state;
  }

  const disambiguation = resolveRoomAliasDisambiguationV1({
    collisionState,
    redactMode: redacted,
    ...(input.safeRoomLocalReferenceAvailable !== undefined
      ? { safeRoomLocalReferenceAvailable: input.safeRoomLocalReferenceAvailable }
      : {}),
  }).strategy;

  return {
    schemaVersion: 1,
    ...(redacted ? {} : { roomId: ref.roomId }),
    ...(!redacted && ref.membershipId !== undefined ? { membershipId: ref.membershipId } : {}),
    ...(!redacted && alias !== undefined ? { roomAlias: alias.displayText.normalizedValue } : {}),
    membershipRole: member.role,
    membershipState: member.state,
    identityAssurance: ref.identityAssurance,
    aliasScope: "this_room_only",
    collisionState,
    disambiguation,
    aliasVerified: false,
    realWorldIdentityVerified: false,
    cryptographicBindingAvailable: false,
    authorityDerivedFromAlias: false,
    redacted,
  };
}
