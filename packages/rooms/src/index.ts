/**
 * @freelayer/rooms — Sovereign Rooms / RoomOS foundation (TECH-16).
 *
 * RoomOS operations are POLICY-CONTROLLED LOCAL STATE TRANSITIONS. This
 * package is a local data model + projection foundation ONLY:
 *
 * - NO network, NO sync, NO CRDT (Gate H — the sync-model decision stays open)
 * - NO crypto, NO keys, NO signatures (Gate F)
 * - NO identity, NO invites, NO verification (Gate G — member refs are local
 *   placeholders)
 * - NO capsule wire format (Gate E)
 * - NO persistent storage in v1 (encrypted backend is Gate F; Ghost/Bunker
 *   never persist; Standard fails hard rather than falling back)
 * - Endpoint Defense / anti-spyware is EXTERNALIZED — `endpoint_hook_ref` is a
 *   compatibility placeholder, never active protection (Gate R)
 *
 * Locked directions preserved (docs/SOVEREIGN_ROOMS.md, ADR-0006): state is
 * derived from an event-sourced operation log, never asserted; local
 * timestamps are never trusted time; no pre-join history by default; room
 * policy binds honest clients only.
 *
 * Apps must not mutate room state directly: every operation passes
 * `assertRoomOperationAllowed` with an authentic PolicyDecision.
 */

export * from "./room-errors";
export * from "./room-types";
export * from "./room-policy";
export * from "./room-events";
export * from "./room-state";
export * from "./room-projection";
export * from "./room-audit";
export * from "./room-factory";
