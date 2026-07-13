/**
 * Monotonic room-policy comparison (TECH-22). A candidate is `stricter` only
 * when NO field becomes less restrictive and at least one becomes MORE
 * restrictive. Any loosening → `looser`; mixed → `incomparable`; unknown field
 * → `unknown`. Governance accepts only `stricter` (with `equal` a no-op) —
 * `looser`/`incomparable`/`unknown` all deny.
 */

import { compositionFail } from "./policy-composition-errors";
import type { RoomPolicyDocumentV1 } from "./room-policy-document";

export type RoomPolicyChangeDirectionV1 =
  "stricter" | "equal" | "looser" | "incomparable" | "unknown";

// Higher rank = STRICTER (more restrictive).
const SENSITIVITY_RANK: Readonly<Record<string, number>> = {
  normal: 0,
  sensitive: 1,
  high_sensitivity: 2,
  critical: 3,
};
const MIN_POSTURE_RANK: Readonly<Record<string, number>> = {
  unverified: 0,
  basic: 1,
  hardened: 2,
  high_assurance: 3,
  managed_bunker: 4,
};
const PROTECTED_RANK: Readonly<Record<string, number>> = {
  none: 0,
  policy_redaction_only: 1,
  secure_device_future_required: 2,
  screen_shield_future_required: 3,
  managed_bunker_future_required: 4,
};
const RETENTION_RANK: Readonly<Record<string, number>> = {
  encrypted_future: 0,
  memory_only: 1,
  null: 2,
};

/** +1 = candidate stricter, -1 = candidate looser, 0 = equal. Unknown → throw. */
function rankDelta(
  map: Readonly<Record<string, number>>,
  current: string,
  candidate: string,
): number {
  const c = map[current];
  const n = map[candidate];
  if (c === undefined || n === undefined) compositionFail("unknown_policy_input", "enum");
  return Math.sign(n - c);
}

/** For an `allowed` boolean, false is STRICTER. +1 stricter / -1 looser / 0 equal. */
function boolDelta(currentAllowed: boolean, candidateAllowed: boolean): number {
  if (currentAllowed === candidateAllowed) return 0;
  return candidateAllowed ? -1 : 1; // candidate allows more → looser
}

export function compareRoomPoliciesV1(input: {
  current: RoomPolicyDocumentV1;
  candidate: RoomPolicyDocumentV1;
}): RoomPolicyChangeDirectionV1 {
  const { current: a, candidate: b } = input;
  if (a.roomId !== b.roomId) return "unknown";

  const deltas: number[] = [];
  try {
    deltas.push(rankDelta(SENSITIVITY_RANK, a.sensitivity, b.sensitivity));
    deltas.push(rankDelta(MIN_POSTURE_RANK, a.minimumDevicePosture, b.minimumDevicePosture));
    deltas.push(
      rankDelta(PROTECTED_RANK, a.protectedContentRequirement, b.protectedContentRequirement),
    );
    deltas.push(rankDelta(RETENTION_RANK, a.storage.maximumRetention, b.storage.maximumRetention));
  } catch {
    return "unknown";
  }
  deltas.push(boolDelta(a.network.networkAllowed, b.network.networkAllowed));
  deltas.push(boolDelta(a.network.directPeerAllowed, b.network.directPeerAllowed));
  deltas.push(boolDelta(a.metadata.receiptsAllowed, b.metadata.receiptsAllowed));
  deltas.push(boolDelta(a.metadata.typingAllowed, b.metadata.typingAllowed));
  deltas.push(boolDelta(a.metadata.presenceAllowed, b.metadata.presenceAllowed));
  deltas.push(boolDelta(a.metadata.exactCountsAllowed, b.metadata.exactCountsAllowed));
  deltas.push(boolDelta(a.metadata.exactTimestampsAllowed, b.metadata.exactTimestampsAllowed));
  deltas.push(boolDelta(a.metadata.actorRefsAllowed, b.metadata.actorRefsAllowed));
  deltas.push(boolDelta(a.notifications.notificationAllowed, b.notifications.notificationAllowed));
  deltas.push(boolDelta(a.ai.localAiAllowed, b.ai.localAiAllowed));

  const anyStricter = deltas.some((d) => d > 0);
  const anyLooser = deltas.some((d) => d < 0);
  if (anyStricter && anyLooser) return "incomparable";
  if (anyLooser) return "looser";
  if (anyStricter) return "stricter";
  return "equal";
}
