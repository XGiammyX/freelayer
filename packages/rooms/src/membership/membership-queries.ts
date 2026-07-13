/**
 * Redacted membership queries (TECH-20). Side-effect-free, policy-gated reads
 * over the membership projection. Each requires its OWN exact-scope decision
 * (`room.membership.query.list/detail/count`); a list decision cannot authorize
 * detail or count. No full identity detail; never returns a capability
 * descriptor, presence, last-seen, or device state. Count needs its own scope.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import { ROOM_CAPABILITY } from "../room-policy";
import { cloneRoomProjection } from "../room-event-v1";
import {
  RoomMembershipDecisionMismatchError,
  RoomMembershipNotFoundError,
  RoomMembershipPolicyDeniedError,
} from "./membership-errors";
import type { RoomMembershipId } from "./membership-ids";
import {
  redactMembershipRecordForQuery,
  type RoomMembershipSummaryViewV1,
} from "./membership-redaction";
import type { RoomMembershipRecordV1 } from "./membership-types";

function assertQueryDecision(decision: PolicyDecision, scope: PolicySideEffectScope): void {
  if (!isPolicyDecision(decision))
    throw new RoomMembershipDecisionMismatchError("decision_missing");
  if (decision.verdict !== "allowed") throw new RoomMembershipPolicyDeniedError("verdict_denied");
  if (decision.capability !== ROOM_CAPABILITY || decision.sideEffect !== scope) {
    throw new RoomMembershipDecisionMismatchError();
  }
}

export interface RoomMembershipListResultV1 {
  readonly result: "room.memberships.list_redacted";
  readonly items: readonly RoomMembershipSummaryViewV1[];
}
export interface RoomMembershipDetailResultV1 {
  readonly result: "room.membership.get_redacted";
  readonly item: RoomMembershipSummaryViewV1;
}
export interface RoomMembershipCountResultV1 {
  readonly result: "room.memberships.count";
  readonly totalCount?: number;
  readonly countsAvailable: boolean;
}

export function queryRoomMembershipsListRedactedV1(input: {
  records: readonly RoomMembershipRecordV1[];
  mode: PrivacyMode;
  decision: PolicyDecision;
  membershipListAllowed: boolean;
}): RoomMembershipListResultV1 {
  assertQueryDecision(input.decision, "room.membership.query.list");
  if (!input.membershipListAllowed) throw new RoomMembershipPolicyDeniedError("list_denied");
  // Deterministic order: membership ID ascending. Cloned for isolation.
  const ordered = cloneRoomProjection(input.records)
    .slice()
    .sort((a, b) => ((a.membershipId as string) < (b.membershipId as string) ? -1 : 1));
  return {
    result: "room.memberships.list_redacted",
    items: ordered.map((r) => redactMembershipRecordForQuery(r, input.mode)),
  };
}

export function queryRoomMembershipGetRedactedV1(input: {
  records: readonly RoomMembershipRecordV1[];
  membershipId: RoomMembershipId;
  mode: PrivacyMode;
  decision: PolicyDecision;
  membershipListAllowed: boolean;
}): RoomMembershipDetailResultV1 {
  assertQueryDecision(input.decision, "room.membership.query.detail");
  if (!input.membershipListAllowed) throw new RoomMembershipPolicyDeniedError("detail_denied");
  const found = input.records.find((r) => r.membershipId === input.membershipId);
  if (found === undefined) throw new RoomMembershipNotFoundError();
  return {
    result: "room.membership.get_redacted",
    item: redactMembershipRecordForQuery(cloneRoomProjection(found), input.mode),
  };
}

export function queryRoomMembershipCountV1(input: {
  records: readonly RoomMembershipRecordV1[];
  mode: PrivacyMode;
  decision: PolicyDecision;
  membershipCountAllowed: boolean;
}): RoomMembershipCountResultV1 {
  assertQueryDecision(input.decision, "room.membership.query.count");
  if (!input.membershipCountAllowed) throw new RoomMembershipPolicyDeniedError("count_denied");
  return {
    result: "room.memberships.count",
    totalCount: input.records.length,
    countsAvailable: true,
  };
}
