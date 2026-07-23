/**
 * Per-room alias pipeline (TECH-ID-06). The policy-gated entry point:
 * validate → resolve policy → require an authentic EXACT-SCOPE PolicyDecision →
 * reduce (pure; validates the caller-resolved binding ref) → persist to a
 * memory/null repository. Denial happens BEFORE mutation; failure produces no
 * partial state. It performs NO direct RoomOS membership mutation. An alias id /
 * text / binding id / room role / DevicePosture NEVER authorizes; an alias-text
 * collision never grants authority.
 *
 * Ordering (documented in §27): validate identity command → the caller has
 * already resolved a current RoomOS room/membership snapshot into the binding
 * ref → resolve room alias policy → verify the exact-scope PolicyDecision (which
 * the caller obtains only after room admission where required) → reduce (dry-run
 * then commit into memory/null) → return. RoomOS remains the authority for
 * membership; the Identity Firewall remains authoritative for the alias record.
 */

import {
  isPolicyDecision,
  type PolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  RoomAliasDecisionMismatchError,
  RoomAliasPolicyDeniedError,
  RoomAliasValidationError,
} from "./room-alias-errors";
import { validateRoomAliasCommandV1 } from "./room-alias-validation";
import {
  resolveRoomAliasPolicyV1,
  roomAliasOperationForCommandV1,
  type RoomAliasOperationV1,
} from "./room-alias-policy";
import { reduceRoomAliasCommandV1 } from "./room-alias-reducer";
import type { RoomAliasGeneratedIdsV1 } from "./room-alias-identifiers";
import type {
  RoomAliasRepositoryV1,
  RoomAliasRepositoryWriteResultV1,
} from "./room-alias-repository";
import type { RoomAliasBindingRefV1, RoomAliasStateV1 } from "./room-alias-types";

/** Write operations reachable through a command (reads have their own entry). */
type RoomAliasCommandOperationV1 = Extract<
  RoomAliasOperationV1,
  "create" | "activate" | "rotate" | "retire"
>;

const SCOPE_FOR_OPERATION: Readonly<Record<RoomAliasCommandOperationV1, PolicySideEffectScope>> = {
  create: "identity.room_alias.create",
  activate: "identity.room_alias.lifecycle",
  retire: "identity.room_alias.lifecycle",
  rotate: "identity.room_alias.rotate",
};

export interface ApplyRoomAliasCommandInputV1 {
  readonly state: RoomAliasStateV1;
  readonly command: unknown;
  readonly mode: PrivacyMode;
  readonly decision: PolicyDecision;
  readonly bindingRef?: RoomAliasBindingRefV1;
  readonly generatedIds: RoomAliasGeneratedIdsV1;
  readonly clockValue: string;
  readonly repository: RoomAliasRepositoryV1;
}

export interface ApplyRoomAliasCommandResultV1 {
  readonly state: RoomAliasStateV1;
  readonly write: RoomAliasRepositoryWriteResultV1;
}

export function applyRoomAliasCommandV1(
  input: ApplyRoomAliasCommandInputV1,
): ApplyRoomAliasCommandResultV1 {
  const command = validateRoomAliasCommandV1(input.command);
  const operation = roomAliasOperationForCommandV1(command.command);
  if (operation === undefined) throw new RoomAliasValidationError("unmapped_operation");

  const policy = resolveRoomAliasPolicyV1({ mode: input.mode, operation });
  if (!policy.allowed) throw new RoomAliasPolicyDeniedError(policy.reasonCode);

  const requiredScope = SCOPE_FOR_OPERATION[operation as RoomAliasCommandOperationV1];
  if (
    !isPolicyDecision(input.decision) ||
    input.decision.verdict !== "allowed" ||
    input.decision.sideEffect !== requiredScope
  ) {
    throw new RoomAliasDecisionMismatchError();
  }

  const next = reduceRoomAliasCommandV1({
    state: input.state,
    command,
    ...(input.bindingRef !== undefined ? { bindingRef: input.bindingRef } : {}),
    generatedIds: input.generatedIds,
    clockValue: input.clockValue,
  });

  const write = input.repository.replace(next, input.decision);
  return { state: next, write };
}
