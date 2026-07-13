/**
 * RoomOS capability attenuation + subset + currency checks (TECH-20).
 *
 * Attenuation may only REDUCE authority: the room, member, membership, and
 * membership revision are immutable; capability/object-kinds/exact-object/
 * maximum-view may only narrow. Widening always rejects. Descriptors remain
 * non-authoritative, non-serializable, non-persistable. Currency binding gives
 * LOCAL staleness protection only — it does not revoke unknown remote copies.
 */

import type { RoomObjectV1 } from "../objects";
import type { RoomQueryViewClass } from "../query";
import {
  RoomCapabilityScopeError,
  RoomCapabilityStaleError,
  RoomCapabilityWideningError,
} from "./membership-errors";
import type { RoomCapabilityNameV1, RoomLocalCapabilityDescriptorV1 } from "./capability-types";
import type { RoomMembershipRecordV1 } from "./membership-types";
import { roleIsEligibleFor } from "./membership-roles";

// How REVEALING a view is (higher = more revealing). Attenuation may not raise.
const VIEW_RANK: Readonly<Record<RoomQueryViewClass, number>> = {
  room_summary_redacted: 0,
  object_summary_redacted: 0,
  room_summary: 1,
  object_summary: 1,
  object_detail_redacted: 1,
  object_detail_content: 2,
};

// Authority rank within the object read/mutation family (higher = more authority).
const OBJECT_CAP_RANK: Partial<Record<RoomCapabilityNameV1, number>> = {
  "room.summary.read": 0,
  "room.object.list": 1,
  "room.object.detail.read": 2,
  "room.object.search_local": 3,
  "room.object.create": 4,
  "room.object.update": 4,
  "room.object.redact": 4,
  "room.object.archive": 4,
  "room.object.tombstone": 4,
};

/** Narrowing is allowed only to an equal capability or a lower-authority one
 *  within the object family; other capabilities may only stay the same. */
function isCapabilityNarrowerOrEqual(
  candidate: RoomCapabilityNameV1,
  parent: RoomCapabilityNameV1,
): boolean {
  if (candidate === parent) return true;
  const c = OBJECT_CAP_RANK[candidate];
  const p = OBJECT_CAP_RANK[parent];
  return c !== undefined && p !== undefined && c <= p;
}

function kindsSubset(
  candidate: readonly RoomObjectV1["kind"][] | undefined,
  parent: readonly RoomObjectV1["kind"][] | undefined,
): boolean {
  if (parent === undefined) return true; // parent unrestricted → any narrower ok
  if (candidate === undefined) return false; // candidate must not broaden to "all"
  return candidate.every((k) => parent.includes(k));
}

export function isRoomCapabilitySubsetV1(
  candidate: RoomLocalCapabilityDescriptorV1,
  parent: RoomLocalCapabilityDescriptorV1,
): boolean {
  if (
    candidate.roomId !== parent.roomId ||
    candidate.memberRef !== parent.memberRef ||
    candidate.membershipId !== parent.membershipId ||
    (candidate.membershipRevision as number) !== (parent.membershipRevision as number) ||
    candidate.sourceRole !== parent.sourceRole ||
    candidate.authoritative !== false
  ) {
    return false;
  }
  if (!isCapabilityNarrowerOrEqual(candidate.capability, parent.capability)) return false;
  if (!kindsSubset(candidate.objectKinds, parent.objectKinds)) return false;
  // exact object: parent-scoped cannot be removed/changed; unrestricted parent
  // may be narrowed to an exact object.
  if (parent.exactObjectId !== undefined && candidate.exactObjectId !== parent.exactObjectId)
    return false;
  // maximum view: candidate may not be MORE revealing.
  if (parent.maximumView !== undefined) {
    if (candidate.maximumView === undefined) return false;
    if (VIEW_RANK[candidate.maximumView] > VIEW_RANK[parent.maximumView]) return false;
  }
  return true;
}

export function attenuateRoomCapabilityDescriptorV1(input: {
  parent: RoomLocalCapabilityDescriptorV1;
  narrowerCapability?: RoomCapabilityNameV1;
  objectKinds?: readonly RoomObjectV1["kind"][];
  exactObjectId?: RoomLocalCapabilityDescriptorV1["exactObjectId"];
  maximumView?: RoomQueryViewClass;
}): RoomLocalCapabilityDescriptorV1 {
  const { parent } = input;
  const candidate: RoomLocalCapabilityDescriptorV1 = {
    ...parent,
    ...(input.narrowerCapability !== undefined ? { capability: input.narrowerCapability } : {}),
    ...(input.objectKinds !== undefined
      ? { objectKinds: Object.freeze([...input.objectKinds]) }
      : {}),
    ...(input.exactObjectId !== undefined ? { exactObjectId: input.exactObjectId } : {}),
    ...(input.maximumView !== undefined ? { maximumView: input.maximumView } : {}),
    authoritative: false,
    serialization: "forbidden",
    delegation: "not_implemented",
    persistence: "forbidden",
  };
  if (!isRoomCapabilitySubsetV1(candidate, parent)) {
    throw new RoomCapabilityWideningError();
  }
  return Object.freeze(candidate);
}

/**
 * Bind a descriptor to the CURRENT local membership. Local staleness only —
 * it does not revoke unknown remote copies or distributed state.
 */
export function assertRoomCapabilityDescriptorCurrentV1(input: {
  descriptor: RoomLocalCapabilityDescriptorV1;
  currentMembership: RoomMembershipRecordV1;
}): void {
  const { descriptor: d, currentMembership: m } = input;
  if (d.authoritative !== false) throw new RoomCapabilityScopeError();
  if (d.roomId !== m.roomId || d.memberRef !== m.memberRef || d.membershipId !== m.membershipId) {
    throw new RoomCapabilityScopeError();
  }
  if ((d.membershipRevision as number) !== (m.revision as number))
    throw new RoomCapabilityStaleError();
  if (d.sourceRole !== m.role) throw new RoomCapabilityStaleError();
  if (m.state !== "active_local_unverified") throw new RoomCapabilityStaleError();
  // The capability must still be within the CURRENT role's eligibility.
  if (!roleIsEligibleFor(m.role, d.capability)) throw new RoomCapabilityStaleError();
}
