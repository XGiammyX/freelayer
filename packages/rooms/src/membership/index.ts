/**
 * @freelayer/rooms — RoomOS membership + local capability scaffolding (TECH-20).
 *
 * Local, UNVERIFIED room-member relationships and NON-AUTHORITATIVE capability
 * descriptors that inform policy evaluation. NOT authentication, NOT invites,
 * NOT cryptographic ownership, NOT transferable authorization. Only an authentic
 * exact-scope PolicyDecision authorizes a side effect. No identity (Gate G), no
 * crypto (Gate F), no sync/distributed revocation (Gate H), no endpoint defense.
 */

export * from "./membership-errors";
export * from "./membership-ids";
export * from "./membership-roles";
export * from "./membership-types";
export * from "./capability-types";
export * from "./capability-resolution";
export * from "./capability-attenuation";
export * from "./authorization-context";
export * from "./membership-commands";
export * from "./membership-policy";
export * from "./membership-events";
export * from "./membership-reducer";
export * from "./membership-log";
export * from "./membership-pipeline";
export * from "./membership-redaction";
export * from "./membership-queries";
