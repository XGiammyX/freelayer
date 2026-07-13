/**
 * @freelayer/rooms — local revocation + authorization regression layer (TECH-21).
 *
 * A centralized, fail-closed, LOCAL authorization model: prepared contexts bound
 * to room/membership/policy/mode/operation revisions are REVALIDATED against
 * current state + an authentic exact-scope PolicyDecision immediately before
 * every protected side effect. Suspension/removal/role-change/reactivation and
 * policy/mode tightening invalidate stale local authority. NOT distributed
 * revocation, NOT verified identity, NOT cryptographic capabilities, NOT
 * endpoint assurance. No authorization cache. Not safe for real secrets.
 */

export * from "./authorization-errors";
export * from "./authorization-revision";
export * from "./prepared-authorization";
export * from "./authorization-revalidation";
export * from "./role-authority";
export * from "./revocation-report";
export * from "./revocation-pipeline";
