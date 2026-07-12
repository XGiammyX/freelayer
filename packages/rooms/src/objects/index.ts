/**
 * @freelayer/rooms — RoomOS Object Model v1 (TECH-18).
 *
 * Concrete LOCAL room objects with explicit, policy-gated, deterministic
 * mutations. NOT messaging transport, NOT a collaborative editor, NOT
 * synchronized. No persistence (Gate F), no CRDT/sync (Gate H), no identity
 * (Gate G), no external parsing (Gate E), no anti-spyware (externalized).
 */

export * from "./object-errors";
export * from "./object-ids";
export * from "./object-limits";
export * from "./object-validation";
export * from "./object-types";
export * from "./object-lifecycle";
export * from "./object-commands";
export * from "./object-policy";
export * from "./object-events";
export * from "./object-reducer";
export * from "./object-redaction";
export * from "./object-log";
export * from "./object-pipeline";
