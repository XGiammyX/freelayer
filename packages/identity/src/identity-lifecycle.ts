/**
 * Identity lifecycle transition tables + pure validators (TECH-ID-03).
 *
 * Conservative, explicit, exhaustive. Unknown transitions DENY (no silent
 * default that returns the current state). Tombstones are terminal and never
 * reactivate. Recovery execution and verification transitions are NOT
 * implemented — the `recovery_required`/`recovered_reverification_required`
 * root states exist in the contract but TECH-ID-03 exposes no command to reach
 * them (no fake recovery).
 */

import { IdentityLifecycleError, IdentityTombstoneError } from "./identity-errors";
import type {
  IdentityPersonaLifecycleV1,
  LocalIdentityRootLifecycleV1,
  PairwiseRelationshipLifecycleV1,
  RoomIdentityBindingLifecycleV1,
} from "./identity-types";

const ROOT_TRANSITIONS: Readonly<
  Record<LocalIdentityRootLifecycleV1, readonly LocalIdentityRootLifecycleV1[]>
> = {
  draft_local: ["active_local", "revoked_tombstone"],
  active_local: ["locked_local", "recovery_required", "compromised_suspected", "revoked_tombstone"],
  locked_local: ["active_local", "recovery_required", "compromised_suspected", "revoked_tombstone"],
  recovery_required: [
    "recovered_reverification_required",
    "compromised_suspected",
    "revoked_tombstone",
  ],
  recovered_reverification_required: ["active_local", "compromised_suspected", "revoked_tombstone"],
  compromised_suspected: ["locked_local", "revoked_tombstone"],
  revoked_tombstone: [],
};

const PERSONA_TRANSITIONS: Readonly<
  Record<IdentityPersonaLifecycleV1, readonly IdentityPersonaLifecycleV1[]>
> = {
  active_local: ["archived_local", "revoked_tombstone"],
  archived_local: ["revoked_tombstone"],
  revoked_tombstone: [],
};

const RELATIONSHIP_TRANSITIONS: Readonly<
  Record<PairwiseRelationshipLifecycleV1, readonly PairwiseRelationshipLifecycleV1[]>
> = {
  draft_local: ["active_local_unverified", "removed_tombstone"],
  active_local_unverified: ["blocked_local", "compromised_suspected", "removed_tombstone"],
  blocked_local: ["compromised_suspected", "removed_tombstone"],
  compromised_suspected: ["removed_tombstone"],
  removed_tombstone: [],
};

const ROOM_BINDING_TRANSITIONS: Readonly<
  Record<RoomIdentityBindingLifecycleV1, readonly RoomIdentityBindingLifecycleV1[]>
> = {
  draft_local: ["active_local_unverified", "removed_tombstone"],
  active_local_unverified: ["suspended_local", "removed_tombstone"],
  suspended_local: ["removed_tombstone"],
  removed_tombstone: [],
};

/** Terminal (tombstone) states — never a transition source. */
const TERMINAL = new Set<string>(["revoked_tombstone", "removed_tombstone"]);

function assertTransition(
  from: string,
  to: string,
  table: Readonly<Record<string, readonly string[]>>,
): void {
  if (TERMINAL.has(from)) throw new IdentityTombstoneError("terminal_state");
  const allowed = table[from];
  if (allowed === undefined) throw new IdentityLifecycleError("unknown_from_state");
  if (from === to || !allowed.includes(to)) {
    throw new IdentityLifecycleError("invalid_transition");
  }
}

export function assertValidIdentityRootTransitionV1(
  from: LocalIdentityRootLifecycleV1,
  to: LocalIdentityRootLifecycleV1,
): void {
  assertTransition(from, to, ROOT_TRANSITIONS);
}
export function assertValidPersonaTransitionV1(
  from: IdentityPersonaLifecycleV1,
  to: IdentityPersonaLifecycleV1,
): void {
  assertTransition(from, to, PERSONA_TRANSITIONS);
}
export function assertValidRelationshipTransitionV1(
  from: PairwiseRelationshipLifecycleV1,
  to: PairwiseRelationshipLifecycleV1,
): void {
  assertTransition(from, to, RELATIONSHIP_TRANSITIONS);
}
export function assertValidRoomBindingTransitionV1(
  from: RoomIdentityBindingLifecycleV1,
  to: RoomIdentityBindingLifecycleV1,
): void {
  assertTransition(from, to, ROOM_BINDING_TRANSITIONS);
}

export function isTerminalIdentityLifecycle(state: string): boolean {
  return TERMINAL.has(state);
}
