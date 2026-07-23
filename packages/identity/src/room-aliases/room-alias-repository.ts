/**
 * Room-alias retention (TECH-ID-06). Memory or Null ONLY — never persistent
 * plaintext, never a database, never a collision/reuse index, never alias
 * history. Every operation requires an authentic `identity.room_alias.*`-scoped
 * decision. The in-memory store defensively clones; the null store retains
 * nothing.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { RoomAliasDecisionMismatchError } from "./room-alias-errors";
import type { RoomAliasStateV1 } from "./room-alias-types";

export interface RoomAliasRepositoryWriteResultV1 {
  readonly outcome: "stored" | "discarded";
  readonly persistenceClass: "memory_only" | "null";
}
export interface RoomAliasRepositoryClearResultV1 {
  readonly outcome: "cleared";
}

export interface RoomAliasRepositoryV1 {
  replace(state: RoomAliasStateV1, decision: PolicyDecision): RoomAliasRepositoryWriteResultV1;
  read(decision: PolicyDecision): RoomAliasStateV1 | null;
  clear(decision: PolicyDecision): RoomAliasRepositoryClearResultV1;
}

function isAuthentic(decision: PolicyDecision): boolean {
  return (
    isPolicyDecision(decision) &&
    decision.verdict === "allowed" &&
    typeof decision.sideEffect === "string" &&
    decision.sideEffect.startsWith("identity.room_alias.")
  );
}
function clone(v: RoomAliasStateV1): RoomAliasStateV1 {
  return structuredClone(v);
}

export class InMemoryRoomAliasRepositoryV1 implements RoomAliasRepositoryV1 {
  #state: RoomAliasStateV1 | null = null;

  replace(state: RoomAliasStateV1, decision: PolicyDecision): RoomAliasRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new RoomAliasDecisionMismatchError();
    this.#state = clone(state);
    return { outcome: "stored", persistenceClass: "memory_only" };
  }
  read(decision: PolicyDecision): RoomAliasStateV1 | null {
    if (!isAuthentic(decision)) throw new RoomAliasDecisionMismatchError();
    return this.#state === null ? null : clone(this.#state);
  }
  clear(decision: PolicyDecision): RoomAliasRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new RoomAliasDecisionMismatchError();
    this.#state = null;
    return { outcome: "cleared" };
  }
}

export class NullRoomAliasRepositoryV1 implements RoomAliasRepositoryV1 {
  replace(_state: RoomAliasStateV1, decision: PolicyDecision): RoomAliasRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new RoomAliasDecisionMismatchError();
    return { outcome: "discarded", persistenceClass: "null" };
  }
  read(decision: PolicyDecision): RoomAliasStateV1 | null {
    if (!isAuthentic(decision)) throw new RoomAliasDecisionMismatchError();
    return null;
  }
  clear(decision: PolicyDecision): RoomAliasRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new RoomAliasDecisionMismatchError();
    return { outcome: "cleared" };
  }
}
