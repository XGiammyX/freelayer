// FIXTURE (not shipped): representative authorization-bypass violations the
// check:no-room-authorization-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

const authorizationCache = new Map();

export function bad(role, prepared, capability, membership, decision) {
  // Role-string authorization outside the approved modules.
  if (role === "owner_placeholder") return true;
  if (role !== "editor_placeholder") return false;
  // Authorization / capability caches + global allow.
  authorizationCache.set(membership.membershipId, true);
  const cap = { capabilityCache: capability };
  const g = { globalAllowDecision: true, lastAllowDecision: decision };
  const mem = { currentMemberAuthorization: membership };
  // Serialization / persistence of prepared context + capability.
  const blob = JSON.stringify(prepared);
  const s = JSON.stringify(capability);
  serializePreparedAuthorization(prepared);
  persistCapability(capability);
  // Authorization storage.
  localStorage.setItem("authz", blob);
  // Caller-controlled revision + endpoint-grants-access.
  const rev = { callerRevision: 99, endpointGrantsAccess: true, endpointSafe: true };
  // Wildcard / auto-promotion / false distributed claims.
  const w = { capabilities: ["*"] };
  autoPromoteOwner(membership);
  const claim = { distributedRevocation: true, cryptographicRevocation: true };
  return { cap, g, mem, s, rev, w, claim };
}
