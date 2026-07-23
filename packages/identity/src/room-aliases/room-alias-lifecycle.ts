/**
 * Room presentation alias lifecycle (TECH-ID-06). Explicit + exhaustive; unknown
 * transitions deny; the retired tombstone is terminal (no reactivation). One
 * active alias per binding is enforced by the reducer, not here.
 */

import { RoomAliasLifecycleError } from "./room-alias-errors";
import type { RoomPresentationAliasLifecycleV1 } from "./room-alias-types";

const ALLOWED: ReadonlyMap<
  RoomPresentationAliasLifecycleV1,
  ReadonlySet<RoomPresentationAliasLifecycleV1>
> = new Map([
  [
    "draft_local",
    new Set<RoomPresentationAliasLifecycleV1>(["active_local_unshared", "retired_tombstone"]),
  ],
  ["active_local_unshared", new Set<RoomPresentationAliasLifecycleV1>(["retired_tombstone"])],
  ["retired_tombstone", new Set<RoomPresentationAliasLifecycleV1>()],
]);

export function assertRoomPresentationAliasTransitionV1(
  from: RoomPresentationAliasLifecycleV1,
  to: RoomPresentationAliasLifecycleV1,
): void {
  const allowed = ALLOWED.get(from);
  if (allowed === undefined || !allowed.has(to)) {
    throw new RoomAliasLifecycleError("forbidden_transition");
  }
}
