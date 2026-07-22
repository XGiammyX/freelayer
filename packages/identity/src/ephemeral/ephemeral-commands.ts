/**
 * Ephemeral identity commands (TECH-ID-04). Discriminated union — NO generic
 * patch, NO promotion/attach/copy/enable-recovery/export/synchronize/extend
 * command exists. Create carries only the lifetime intent; the reducer assigns
 * ids + computes the deadline from an injected clock. Every non-create update
 * carries the expected current revision.
 */

import type {
  IdentityLocalRevision,
  IdentityPersonaId,
  LocalIdentityRootId,
  PairwiseRelationshipId,
  RoomLocalIdRef,
  RoomMembershipIdRef,
} from "../identifiers";
import type { EphemeralIdentityLifetimeModeV1 } from "./ephemeral-types";

export type EphemeralIdentityCommandNameV1 =
  | "identity.ephemeral.create"
  | "identity.ephemeral.activate"
  | "identity.ephemeral.shorten_lifetime"
  | "identity.ephemeral.mark_compromised"
  | "identity.ephemeral.expire"
  | "identity.ephemeral.destroy"
  | "identity.ephemeral.persona.create"
  | "identity.ephemeral.relationship.create_placeholder"
  | "identity.ephemeral.relationship.block"
  | "identity.ephemeral.room_binding.create_placeholder";

export const EPHEMERAL_IDENTITY_COMMAND_NAMES: readonly EphemeralIdentityCommandNameV1[] = [
  "identity.ephemeral.create",
  "identity.ephemeral.activate",
  "identity.ephemeral.shorten_lifetime",
  "identity.ephemeral.mark_compromised",
  "identity.ephemeral.expire",
  "identity.ephemeral.destroy",
  "identity.ephemeral.persona.create",
  "identity.ephemeral.relationship.create_placeholder",
  "identity.ephemeral.relationship.block",
  "identity.ephemeral.room_binding.create_placeholder",
];

interface Base {
  readonly schemaVersion: 1;
}

export interface CreateEphemeralIdentityCommandV1 extends Base {
  readonly command: "identity.ephemeral.create";
  readonly lifetimeMode: EphemeralIdentityLifetimeModeV1;
  readonly durationMs?: number;
}
export interface ActivateEphemeralIdentityCommandV1 extends Base {
  readonly command: "identity.ephemeral.activate";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface ShortenEphemeralIdentityLifetimeCommandV1 extends Base {
  readonly command: "identity.ephemeral.shorten_lifetime";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
  readonly newDurationMs: number;
}
export interface MarkEphemeralIdentityCompromisedCommandV1 extends Base {
  readonly command: "identity.ephemeral.mark_compromised";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface ExpireEphemeralIdentityCommandV1 extends Base {
  readonly command: "identity.ephemeral.expire";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface DestroyEphemeralIdentityCommandV1 extends Base {
  readonly command: "identity.ephemeral.destroy";
  readonly rootId: LocalIdentityRootId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface CreateEphemeralPersonaCommandV1 extends Base {
  readonly command: "identity.ephemeral.persona.create";
  readonly rootId: LocalIdentityRootId;
  readonly localLabel?: string;
}
export interface CreateEphemeralRelationshipPlaceholderCommandV1 extends Base {
  readonly command: "identity.ephemeral.relationship.create_placeholder";
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
}
export interface BlockEphemeralRelationshipCommandV1 extends Base {
  readonly command: "identity.ephemeral.relationship.block";
  readonly relationshipId: PairwiseRelationshipId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface CreateEphemeralRoomBindingPlaceholderCommandV1 extends Base {
  readonly command: "identity.ephemeral.room_binding.create_placeholder";
  readonly roomId: RoomLocalIdRef;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
  readonly membershipId?: RoomMembershipIdRef;
}

export type EphemeralIdentityCommandV1 =
  | CreateEphemeralIdentityCommandV1
  | ActivateEphemeralIdentityCommandV1
  | ShortenEphemeralIdentityLifetimeCommandV1
  | MarkEphemeralIdentityCompromisedCommandV1
  | ExpireEphemeralIdentityCommandV1
  | DestroyEphemeralIdentityCommandV1
  | CreateEphemeralPersonaCommandV1
  | CreateEphemeralRelationshipPlaceholderCommandV1
  | BlockEphemeralRelationshipCommandV1
  | CreateEphemeralRoomBindingPlaceholderCommandV1;
