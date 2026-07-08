/**
 * @freelayer/rooms — Sovereign Rooms / RoomOS type scaffolding. NO BEHAVIOR.
 *
 * Locked directions this scaffolding encodes (docs/SOVEREIGN_ROOMS.md, ADR-0006):
 * - RoomOS base is an EVENT-SOURCED OPERATION LOG; room state is derived from
 *   authenticated operations, never asserted.
 * - The CRDT choice for collaborative documents is DEFERRED: no Yjs, no
 *   Automerge, no Loro, no custom CRDT in Prompt 03. A formal evaluation memo
 *   and a new ADR are required before implementation (Gate H). These types
 *   must not lock us into any one library.
 * - NO PRE-JOIN HISTORY by default; changing this requires an ADR.
 * - Local timestamps are NOT trusted global time; trusted timestamping for
 *   decisions/polls is future research. Ordering uses logical order plus,
 *   once crypto exists (Gate F), author signatures.
 * - Decisions may become signed/provable (proof-of-agreement) later.
 * - AI artifacts are suggestions until human-confirmed (ADR-0007).
 * - Room policy binds honest clients; hostile clients cannot be forced to
 *   obey it. UI and docs must state this honestly.
 *
 * No sync, no merge, no documents, no decisions/polls behavior here.
 */

import type { Brand } from "@freelayer/security";
import type { PrivacyMode, PolicyDecision } from "@freelayer/privacy";

export type RoomId = Brand<string, "RoomId">;
export type RoomOperationId = Brand<string, "RoomOperationId">;

/** Object types a Sovereign Room may contain (docs/SOVEREIGN_ROOMS.md). */
export type RoomObjectKind =
  | "message"
  | "note"
  | "document"
  | "file"
  | "task"
  | "decision"
  | "poll"
  | "room_memory"
  | "ai_artifact";

/**
 * Timestamp model: local wall clock + logical order. `trusted` is literally
 * `false` at the type level — nothing in v1 may treat room time as trusted.
 */
export interface RoomTimestampModel {
  readonly localWallClockMs: number;
  readonly logicalOrder: number;
  readonly trusted: false;
}

/** Pre-join history rule. Default is locked (ADR required to change). */
export type RoomHistoryPolicy = "no_pre_join_history" | "future_configurable_todo";

/** Room policy placeholder. Participates in strictest-wins (docs/PRIVACY_MODEL.md). */
export interface RoomPolicy {
  readonly historyPolicy: RoomHistoryPolicy;
  /** Strictest mode this room demands of honest clients; device mode may be stricter. */
  readonly minimumMode: PrivacyMode;
}

/**
 * One entry in the room operation log. `authorHint` is unauthenticated until
 * operation signing exists (Gate F) — nothing may treat it as proof of
 * authorship. Payload stays `unknown`: object-type schemas are Gate H design,
 * and all operation payloads are hostile input (docs/THREAT_MODEL.md).
 */
export interface RoomOperation {
  readonly id: RoomOperationId;
  readonly roomId: RoomId;
  readonly objectKind: RoomObjectKind;
  readonly authorHint: string;
  readonly timestamp: RoomTimestampModel;
  readonly payloadDraft: unknown;
}

/** Append-only per-author log interface. Appending persists → PolicyDecision required. */
export interface RoomOperationLog {
  append(operation: RoomOperation, decision: PolicyDecision): Promise<void>;
  /** Materialization is derived state; merge rules are Gate H design. */
  operations(decision: PolicyDecision): Promise<readonly RoomOperation[]>;
}

/**
 * Decision record placeholder. Once crypto exists, decisions become signed,
 * member-verifiable records (proof-of-agreement) — unlike chat, which may
 * prefer deniability. See docs/SOVEREIGN_ROOMS.md decision ledger.
 */
export interface DecisionRecord {
  readonly operationId: RoomOperationId;
  readonly summary: string;
  readonly recordedAt: RoomTimestampModel;
  readonly proof: ProofOfAgreementPlaceholder;
}

/** No signatures exist yet (Gate F). The empty tuple type makes that unforgeable-by-accident. */
export interface ProofOfAgreementPlaceholder {
  readonly status: "unsigned_placeholder";
  readonly signatures: readonly never[];
}
