/**
 * Room materialized state (TECH-16) — DERIVED data, rebuildable from the
 * event log; never asserted, never persisted in v1 (projection persistence
 * follows StoragePolicy and is future-gated behind encrypted storage).
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomPolicy } from "./room-policy";
import type { RoomMembershipRecordV1 } from "./membership/membership-types";
import type { RoomPolicyDocumentV1 } from "./policy-composition/room-policy-document";
import type {
  RoomKind,
  RoomLifecycleState,
  RoomLocalId,
  RoomMemberRef,
  RoomObjectKind,
} from "./room-types";

export interface RoomMemberSummary {
  readonly ref: RoomMemberRef;
  /** Strict modes redact member display; no display name is stored in v1. */
  readonly displayNameRedacted: boolean;
  /** Roles are Gate G placeholders — no real authorization semantics. */
  readonly role: "owner_placeholder" | "member_placeholder" | "viewer_placeholder" | "unknown";
}

export interface RoomObjectSummary {
  readonly id: string;
  readonly kind: RoomObjectKind;
  /** Summaries never carry content — content stays in the (memory) event. */
  readonly redacted: boolean;
  readonly sensitivity: string;
  readonly storageClass: string;
}

export interface RoomMaterializedState {
  readonly roomId: RoomLocalId;
  readonly kind: RoomKind;
  readonly lifecycle: RoomLifecycleState;
  readonly mode: PrivacyMode;
  readonly titleRedacted: boolean;
  /** Absent when policy redacts titles (Bunker/critical risk/room policy). */
  readonly title?: string;
  readonly members: readonly RoomMemberSummary[];
  readonly objects: readonly RoomObjectSummary[];
  /**
   * TECH-20: local, unverified membership records (relationship metadata).
   * Optional so pre-membership construction stays valid; memory-only, never
   * persisted. Changed only through the membership reducer.
   */
  readonly membershipRecords?: readonly RoomMembershipRecordV1[];
  /**
   * TECH-21: a local, positive policy-revision counter incremented on every
   * accepted (tightening) room-policy change. Bound into prepared authorization
   * so a policy change invalidates prepared contexts. Local only — NOT a global
   * version, trusted time, or distributed consistency token. Defaults to a
   * derived fingerprint of the current RoomPolicy when absent.
   */
  readonly policyRevision?: number;
  /**
   * TECH-22: the explicit, versioned, tighten-only room policy document.
   * Optional (pre-governance construction stays valid); memory-only, never
   * persisted. Changed only through the governance reducer.
   */
  readonly policyDocument?: RoomPolicyDocumentV1;
  /** LOCAL label only ("local:" prefix) — never trusted time. */
  readonly lastLocalUpdateAt?: string;
  readonly policy: RoomPolicy;
}
