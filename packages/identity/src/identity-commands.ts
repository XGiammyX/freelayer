/**
 * Explicit local identity mutation commands (TECH-ID-03). A discriminated union
 * — NO generic patch/update/set_property/merge. Create commands carry only the
 * parent references + an optional local label; the reducer assigns the id from
 * injected `generatedIds`. Every non-create update carries the expected current
 * revision (optimistic concurrency). Unknown commands deny.
 */

import type {
  IdentityPersonaId,
  IdentityLocalRevision,
  LocalIdentityRootId,
  PairwiseRelationshipId,
  RoomIdentityBindingId,
  RoomLocalIdRef,
  RoomMembershipIdRef,
} from "./identifiers";

export type LocalIdentityCommandNameV1 =
  | "identity.root.create_local"
  | "identity.root.activate_local"
  | "identity.root.lock_local"
  | "identity.root.mark_compromised"
  | "identity.root.tombstone"
  | "identity.persona.create_local"
  | "identity.persona.archive_local"
  | "identity.persona.tombstone"
  | "identity.relationship.create_placeholder"
  | "identity.relationship.block_local"
  | "identity.relationship.mark_compromised"
  | "identity.relationship.tombstone"
  | "identity.room_binding.create_placeholder"
  | "identity.room_binding.suspend_local"
  | "identity.room_binding.tombstone";

export const LOCAL_IDENTITY_COMMAND_NAMES: readonly LocalIdentityCommandNameV1[] = [
  "identity.root.create_local",
  "identity.root.activate_local",
  "identity.root.lock_local",
  "identity.root.mark_compromised",
  "identity.root.tombstone",
  "identity.persona.create_local",
  "identity.persona.archive_local",
  "identity.persona.tombstone",
  "identity.relationship.create_placeholder",
  "identity.relationship.block_local",
  "identity.relationship.mark_compromised",
  "identity.relationship.tombstone",
  "identity.room_binding.create_placeholder",
  "identity.room_binding.suspend_local",
  "identity.room_binding.tombstone",
];

interface CommandBaseV1 {
  readonly schemaVersion: 1;
}

// ---- Root ----
export interface CreateLocalIdentityRootCommandV1 extends CommandBaseV1 {
  readonly command: "identity.root.create_local";
}
export interface ActivateLocalIdentityRootCommandV1 extends CommandBaseV1 {
  readonly command: "identity.root.activate_local";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface LockLocalIdentityRootCommandV1 extends CommandBaseV1 {
  readonly command: "identity.root.lock_local";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface MarkLocalIdentityRootCompromisedCommandV1 extends CommandBaseV1 {
  readonly command: "identity.root.mark_compromised";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface TombstoneLocalIdentityRootCommandV1 extends CommandBaseV1 {
  readonly command: "identity.root.tombstone";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}

// ---- Persona ----
export interface CreateIdentityPersonaCommandV1 extends CommandBaseV1 {
  readonly command: "identity.persona.create_local";
  readonly rootId: LocalIdentityRootId;
  readonly localLabel?: string;
}
export interface ArchiveIdentityPersonaCommandV1 extends CommandBaseV1 {
  readonly command: "identity.persona.archive_local";
  readonly personaId: IdentityPersonaId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface TombstoneIdentityPersonaCommandV1 extends CommandBaseV1 {
  readonly command: "identity.persona.tombstone";
  readonly personaId: IdentityPersonaId;
  readonly expectedRevision: IdentityLocalRevision;
}

// ---- Pairwise relationship ----
export interface CreatePairwiseRelationshipPlaceholderCommandV1 extends CommandBaseV1 {
  readonly command: "identity.relationship.create_placeholder";
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
}
export interface BlockPairwiseRelationshipCommandV1 extends CommandBaseV1 {
  readonly command: "identity.relationship.block_local";
  readonly relationshipId: PairwiseRelationshipId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface MarkPairwiseRelationshipCompromisedCommandV1 extends CommandBaseV1 {
  readonly command: "identity.relationship.mark_compromised";
  readonly relationshipId: PairwiseRelationshipId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface TombstonePairwiseRelationshipCommandV1 extends CommandBaseV1 {
  readonly command: "identity.relationship.tombstone";
  readonly relationshipId: PairwiseRelationshipId;
  readonly expectedRevision: IdentityLocalRevision;
}

// ---- Room identity binding ----
export interface CreateRoomIdentityBindingPlaceholderCommandV1 extends CommandBaseV1 {
  readonly command: "identity.room_binding.create_placeholder";
  readonly roomId: RoomLocalIdRef;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly membershipId?: RoomMembershipIdRef;
}
export interface SuspendRoomIdentityBindingCommandV1 extends CommandBaseV1 {
  readonly command: "identity.room_binding.suspend_local";
  readonly bindingId: RoomIdentityBindingId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface TombstoneRoomIdentityBindingCommandV1 extends CommandBaseV1 {
  readonly command: "identity.room_binding.tombstone";
  readonly bindingId: RoomIdentityBindingId;
  readonly expectedRevision: IdentityLocalRevision;
}

export type LocalIdentityCommandV1 =
  | CreateLocalIdentityRootCommandV1
  | ActivateLocalIdentityRootCommandV1
  | LockLocalIdentityRootCommandV1
  | MarkLocalIdentityRootCompromisedCommandV1
  | TombstoneLocalIdentityRootCommandV1
  | CreateIdentityPersonaCommandV1
  | ArchiveIdentityPersonaCommandV1
  | TombstoneIdentityPersonaCommandV1
  | CreatePairwiseRelationshipPlaceholderCommandV1
  | BlockPairwiseRelationshipCommandV1
  | MarkPairwiseRelationshipCompromisedCommandV1
  | TombstonePairwiseRelationshipCommandV1
  | CreateRoomIdentityBindingPlaceholderCommandV1
  | SuspendRoomIdentityBindingCommandV1
  | TombstoneRoomIdentityBindingCommandV1;
