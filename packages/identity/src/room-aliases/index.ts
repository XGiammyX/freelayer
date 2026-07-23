/**
 * Per-room alias foundations (TECH-ID-06). Local, room-scoped, non-cryptographic,
 * metadata-only presentation bound to ONE identity room binding. A room alias is
 * NOT identity, membership, role, verification, a RoomMemberRef, or a global
 * username. Reuses the TECH-ID-05 text normalization; never imports
 * @freelayer/rooms (RoomOS role/state are a narrow caller-supplied read model).
 */

export * from "./room-alias-errors";
export * from "./room-alias-identifiers";
export * from "./room-alias-types";
export * from "./room-alias-validation";
export * from "./room-alias-lifecycle";
export * from "./room-alias-collision";
export * from "./room-alias-disambiguation";
export * from "./room-alias-policy";
export * from "./room-alias-commands";
export * from "./room-alias-reducer";
export * from "./room-alias-repository";
export * from "./room-alias-pipeline";
export * from "./room-alias-summary";
