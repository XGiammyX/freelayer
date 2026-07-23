/**
 * Device authorization scope model (TECH-ID-07). A scope is the MAXIMUM identity
 * context a device may LATER operate within. Scopes reference exactly one root;
 * there is no wildcard, no multi-root, no cross-root scope, and no scope inferred
 * from a label or DevicePosture. Attenuation is monotonic: a scope may only be
 * narrowed or held equal, never widened; read-only may never become writable.
 */

import type {
  IdentityPersonaId,
  LocalIdentityRootId,
  PairwiseRelationshipId,
  RoomIdentityBindingId,
} from "../identifiers";
import { DeviceAuthorizationScopeError } from "./device-errors";

export type DeviceAuthorizationScopeKindV1 =
  "identity_root" | "persona" | "relationship" | "room" | "read_only";

export const DEVICE_SCOPE_KINDS: readonly DeviceAuthorizationScopeKindV1[] = [
  "identity_root",
  "persona",
  "relationship",
  "room",
  "read_only",
];

export interface DeviceAuthorizationScopeV1 {
  readonly kind: DeviceAuthorizationScopeKindV1;
  readonly rootId: LocalIdentityRootId;
  readonly personaId?: IdentityPersonaId;
  readonly relationshipId?: PairwiseRelationshipId;
  readonly roomBindingId?: RoomIdentityBindingId;
  readonly readOnly: boolean;
}

/**
 * Fail-closed structural validation of a scope. Ensures the narrower ids present
 * exactly match the kind, read-only carries no mutation authority, and no
 * wildcard/multi-root shape is possible.
 */
export function validateDeviceAuthorizationScopeV1(
  scope: DeviceAuthorizationScopeV1,
): DeviceAuthorizationScopeV1 {
  if (!DEVICE_SCOPE_KINDS.includes(scope.kind))
    throw new DeviceAuthorizationScopeError("unknown_kind");
  if (typeof scope.rootId !== "string" || scope.rootId.length === 0) {
    throw new DeviceAuthorizationScopeError("missing_root");
  }
  if (typeof scope.readOnly !== "boolean") throw new DeviceAuthorizationScopeError("bad_read_only");

  const hasPersona = scope.personaId !== undefined;
  const hasRelationship = scope.relationshipId !== undefined;
  const hasRoom = scope.roomBindingId !== undefined;

  switch (scope.kind) {
    case "identity_root":
      if (hasPersona || hasRelationship || hasRoom) {
        throw new DeviceAuthorizationScopeError("root_scope_has_narrower_ids");
      }
      break;
    case "persona":
      if (!hasPersona || hasRelationship || hasRoom) {
        throw new DeviceAuthorizationScopeError("persona_scope_shape");
      }
      break;
    case "relationship":
      if (!hasPersona || !hasRelationship || hasRoom) {
        throw new DeviceAuthorizationScopeError("relationship_scope_shape");
      }
      break;
    case "room":
      if (!hasPersona || !hasRoom || hasRelationship) {
        throw new DeviceAuthorizationScopeError("room_scope_shape");
      }
      break;
    case "read_only":
      if (!scope.readOnly) throw new DeviceAuthorizationScopeError("read_only_must_be_read_only");
      if (hasPersona || hasRelationship || hasRoom) {
        throw new DeviceAuthorizationScopeError("read_only_scope_shape");
      }
      break;
    default: {
      const _never: never = scope.kind;
      throw new DeviceAuthorizationScopeError(`unhandled:${String(_never)}`);
    }
  }
  return scope;
}

/** True iff `wider` is equal-or-wider than `narrower` (same root; monotonic). */
export function deviceScopeContainsV1(
  wider: DeviceAuthorizationScopeV1,
  narrower: DeviceAuthorizationScopeV1,
): boolean {
  if (wider.rootId !== narrower.rootId) return false; // cross-root never contains
  if (wider.readOnly && !narrower.readOnly) return false; // read-only cannot widen to writable
  switch (wider.kind) {
    case "identity_root":
      return true;
    case "persona":
      if (narrower.kind === "identity_root") return false;
      if (narrower.kind === "read_only") return true;
      return narrower.personaId === wider.personaId;
    case "relationship":
      if (narrower.kind === "read_only") return true;
      return (
        narrower.kind === "relationship" &&
        narrower.personaId === wider.personaId &&
        narrower.relationshipId === wider.relationshipId
      );
    case "room":
      if (narrower.kind === "read_only") return true;
      return (
        narrower.kind === "room" &&
        narrower.personaId === wider.personaId &&
        narrower.roomBindingId === wider.roomBindingId
      );
    case "read_only":
      return narrower.kind === "read_only";
    default: {
      const _never: never = wider.kind;
      return Boolean(_never);
    }
  }
}

/**
 * Attenuate a scope: return `requested` only if it is equal-or-narrower than
 * `current`. Widening, cross-root, or incomparable transitions reject.
 */
export function attenuateDeviceAuthorizationScopeV1(input: {
  current: DeviceAuthorizationScopeV1;
  requested: DeviceAuthorizationScopeV1;
}): DeviceAuthorizationScopeV1 {
  validateDeviceAuthorizationScopeV1(input.current);
  validateDeviceAuthorizationScopeV1(input.requested);
  if (input.current.rootId !== input.requested.rootId) {
    throw new DeviceAuthorizationScopeError("cross_root_forbidden");
  }
  if (!deviceScopeContainsV1(input.current, input.requested)) {
    throw new DeviceAuthorizationScopeError("scope_widening_forbidden");
  }
  return input.requested;
}
