/**
 * Per-contact alias commands (TECH-ID-05). A discriminated union — NO generic
 * alias/profile patch. Rotation explicitly identifies the current alias being
 * retired. Text fields are raw input; the validator normalizes them. Every
 * non-create update carries the expected current revision.
 */

import type {
  IdentityLocalRevision,
  IdentityPersonaId,
  LocalIdentityRootId,
  PairwiseRelationshipId,
} from "../identifiers";
import type { ContactAliasId, LocalPeerLabelId } from "./alias-identifiers";

export type ContactAliasCommandNameV1 =
  | "identity.alias.presentation.create"
  | "identity.alias.presentation.activate"
  | "identity.alias.presentation.rotate"
  | "identity.alias.presentation.retire"
  | "identity.alias.local_peer_label.set"
  | "identity.alias.local_peer_label.replace"
  | "identity.alias.local_peer_label.clear";

export const CONTACT_ALIAS_COMMAND_NAMES: readonly ContactAliasCommandNameV1[] = [
  "identity.alias.presentation.create",
  "identity.alias.presentation.activate",
  "identity.alias.presentation.rotate",
  "identity.alias.presentation.retire",
  "identity.alias.local_peer_label.set",
  "identity.alias.local_peer_label.replace",
  "identity.alias.local_peer_label.clear",
];

interface Base {
  readonly schemaVersion: 1;
}
interface RelRef {
  readonly relationshipId: PairwiseRelationshipId;
  readonly rootId: LocalIdentityRootId;
  readonly personaId: IdentityPersonaId;
}

export interface CreatePairwisePresentationAliasCommandV1 extends Base, RelRef {
  readonly command: "identity.alias.presentation.create";
  readonly displayText: string;
}
export interface ActivatePairwisePresentationAliasCommandV1 extends Base {
  readonly command: "identity.alias.presentation.activate";
  readonly aliasId: ContactAliasId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface RotatePairwisePresentationAliasCommandV1 extends Base, RelRef {
  readonly command: "identity.alias.presentation.rotate";
  readonly currentAliasId: ContactAliasId;
  readonly currentExpectedRevision: IdentityLocalRevision;
  readonly newDisplayText: string;
}
export interface RetirePairwisePresentationAliasCommandV1 extends Base {
  readonly command: "identity.alias.presentation.retire";
  readonly aliasId: ContactAliasId;
  readonly expectedRevision: IdentityLocalRevision;
}
export interface SetLocalPeerLabelCommandV1 extends Base, RelRef {
  readonly command: "identity.alias.local_peer_label.set";
  readonly labelText: string;
}
export interface ReplaceLocalPeerLabelCommandV1 extends Base {
  readonly command: "identity.alias.local_peer_label.replace";
  readonly labelId: LocalPeerLabelId;
  readonly expectedRevision: IdentityLocalRevision;
  readonly labelText: string;
}
export interface ClearLocalPeerLabelCommandV1 extends Base {
  readonly command: "identity.alias.local_peer_label.clear";
  readonly labelId: LocalPeerLabelId;
  readonly expectedRevision: IdentityLocalRevision;
}

export type ContactAliasCommandV1 =
  | CreatePairwisePresentationAliasCommandV1
  | ActivatePairwisePresentationAliasCommandV1
  | RotatePairwisePresentationAliasCommandV1
  | RetirePairwisePresentationAliasCommandV1
  | SetLocalPeerLabelCommandV1
  | ReplaceLocalPeerLabelCommandV1
  | ClearLocalPeerLabelCommandV1;
