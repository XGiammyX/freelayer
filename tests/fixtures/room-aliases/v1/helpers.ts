/**
 * Per-room alias test helpers (TECH-ID-06). SYNTHETIC only — no real personal
 * names/phones/emails/secrets. Deterministic ids + injected clock. RoomOS role/
 * state values are the narrow caller-supplied read model (identity never imports
 * @freelayer/rooms).
 */

import {
  issuePolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  applyRoomAliasCommandV1,
  emptyRoomAliasStateV1,
  InMemoryRoomAliasRepositoryV1,
  validateIdentityPersonaId,
  validateLocalIdentityRootId,
  validateRoomIdentityBindingId,
  validateRoomLocalIdRef,
  validateRoomMembershipIdRef,
  validateRoomPresentationAliasId,
  type RoomAliasBindingRefV1,
  type RoomAliasGeneratedIdsV1,
  type RoomAliasRepositoryV1,
  type RoomAliasStateV1,
} from "@freelayer/identity";

export const ROOM_ALIAS_SENTINEL = "FREELAYER_ROOM_ALIAS_SENTINEL_DO_NOT_LEAK";
export const CLOCK = "local:0";

export const ROOM = validateRoomLocalIdRef("room-ra-1");
export const MEMBER = validateRoomMembershipIdRef("member-ra-1");
export const BINDING = validateRoomIdentityBindingId("idrb-ra-1");
export const ROOT = validateLocalIdentityRootId("idr-ra-1");
export const PERSONA = validateIdentityPersonaId("idp-ra-1");

export function ref(over?: Partial<RoomAliasBindingRefV1>): RoomAliasBindingRefV1 {
  return {
    bindingId: BINDING,
    roomId: ROOM,
    rootId: ROOT,
    personaId: PERSONA,
    rootKind: "long_lived_local",
    membershipId: MEMBER,
    bindingLifecycle: "active_local_unverified",
    bindingRevision: 1 as RoomAliasBindingRefV1["bindingRevision"],
    membershipState: "active_local_unverified",
    membershipRole: "editor_placeholder",
    identityAssurance: "unverified_local",
    rootBindingActive: true,
    ...over,
  };
}

let seq = 0;
export function nextIds(): Required<RoomAliasGeneratedIdsV1> {
  seq += 1;
  return { aliasId: validateRoomPresentationAliasId(`ralias-a${seq}`) };
}

export function emptyState(pc: "memory_only" | "null" = "memory_only"): RoomAliasStateV1 {
  return emptyRoomAliasStateV1(pc);
}
export function repo(): RoomAliasRepositoryV1 {
  return new InMemoryRoomAliasRepositoryV1();
}
export function decisionFor(scope: PolicySideEffectScope, mode: PrivacyMode = "standard") {
  return issuePolicyDecision("persistence", "allowed", mode, scope);
}

export function createCommand(displayText = "Blue Fox", r = ref()) {
  return {
    schemaVersion: 1,
    command: "identity.room_alias.create",
    roomId: r.roomId,
    bindingId: r.bindingId,
    rootId: r.rootId,
    personaId: r.personaId,
    membershipId: r.membershipId,
    expectedBindingRevision: r.bindingRevision,
    displayText,
  };
}

export function applyRA(input: {
  state: RoomAliasStateV1;
  command: unknown;
  scope: PolicySideEffectScope;
  mode?: PrivacyMode;
  bindingRef?: RoomAliasBindingRefV1;
  generatedIds?: RoomAliasGeneratedIdsV1;
  repository?: RoomAliasRepositoryV1;
}) {
  return applyRoomAliasCommandV1({
    state: input.state,
    command: input.command,
    mode: input.mode ?? "standard",
    decision: decisionFor(input.scope, input.mode ?? "standard"),
    ...(input.bindingRef !== undefined ? { bindingRef: input.bindingRef } : {}),
    generatedIds: input.generatedIds ?? {},
    clockValue: CLOCK,
    repository: input.repository ?? repo(),
  });
}

/** Create + activate a room presentation alias, returning the state + alias id. */
export function activeRoomAlias(
  displayText = "Blue Fox",
  r = ref(),
): { state: RoomAliasStateV1; aliasId: ReturnType<typeof validateRoomPresentationAliasId> } {
  const aliasId = nextIds().aliasId;
  const created = applyRA({
    state: emptyState(),
    command: createCommand(displayText, r),
    scope: "identity.room_alias.create",
    bindingRef: r,
    generatedIds: { aliasId },
  }).state;
  const active = applyRA({
    state: created,
    command: {
      schemaVersion: 1,
      command: "identity.room_alias.activate",
      aliasId,
      expectedRevision: 1,
    },
    scope: "identity.room_alias.lifecycle",
  }).state;
  return { state: active, aliasId };
}
