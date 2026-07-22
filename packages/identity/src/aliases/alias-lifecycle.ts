/**
 * Alias lifecycle transition validators (TECH-ID-05). Conservative, explicit,
 * exhaustive. Retired/cleared states are terminal (no reactivation). Rotation
 * creates a NEW record and retires the previous one — it never mutates a retired
 * record back to active and never transfers an alias between relationships.
 */

import { ContactAliasLifecycleError } from "./alias-errors";
import type {
  LocalPeerLabelLifecycleV1,
  PairwisePresentationAliasLifecycleV1,
} from "./alias-types";

const PRESENTATION_TRANSITIONS: Readonly<
  Record<PairwisePresentationAliasLifecycleV1, readonly PairwisePresentationAliasLifecycleV1[]>
> = {
  draft_local: ["active_local_unshared", "retired_tombstone"],
  active_local_unshared: ["retired_tombstone"],
  retired_tombstone: [],
};

const LABEL_TRANSITIONS: Readonly<
  Record<LocalPeerLabelLifecycleV1, readonly LocalPeerLabelLifecycleV1[]>
> = {
  active_local_private: ["cleared_tombstone"],
  cleared_tombstone: [],
};

export function assertPresentationAliasTransitionV1(
  from: PairwisePresentationAliasLifecycleV1,
  to: PairwisePresentationAliasLifecycleV1,
): void {
  const allowed = PRESENTATION_TRANSITIONS[from];
  if (allowed === undefined || from === to || !allowed.includes(to)) {
    throw new ContactAliasLifecycleError("invalid_transition");
  }
}

export function assertLocalPeerLabelTransitionV1(
  from: LocalPeerLabelLifecycleV1,
  to: LocalPeerLabelLifecycleV1,
): void {
  const allowed = LABEL_TRANSITIONS[from];
  if (allowed === undefined || from === to || !allowed.includes(to)) {
    throw new ContactAliasLifecycleError("invalid_transition");
  }
}
