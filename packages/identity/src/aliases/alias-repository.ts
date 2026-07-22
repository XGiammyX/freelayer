/**
 * Per-contact alias repositories (TECH-ID-05). MEMORY-ONLY or NULL — no disk, no
 * browser storage, no database, no encrypted storage (encrypted alias persistence
 * is a Gate F + vault-storage question). Deep defensive clones; no global
 * singleton; no serialized snapshot; no hidden history; explicit clear. Every
 * operation requires an authentic `identity.alias.*`-scoped decision.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { ContactAliasDecisionMismatchError } from "./alias-errors";
import type { ContactAliasStateV1 } from "./alias-types";

export interface ContactAliasRepositoryWriteResultV1 {
  readonly outcome: "written" | "discarded";
  readonly retention: "memory_only" | "null";
  readonly reasonCode: string;
}
export interface ContactAliasRepositoryClearResultV1 {
  readonly outcome: "cleared" | "nothing_to_clear";
  readonly retention: "memory_only" | "null";
  readonly reasonCode: string;
}

export interface ContactAliasRepositoryV1 {
  readonly retention: "memory_only" | "null";
  read(decision: PolicyDecision): ContactAliasStateV1 | null;
  replace(next: ContactAliasStateV1, decision: PolicyDecision): ContactAliasRepositoryWriteResultV1;
  clear(decision: PolicyDecision): ContactAliasRepositoryClearResultV1;
}

function isAuthentic(decision: PolicyDecision): boolean {
  return (
    isPolicyDecision(decision) &&
    decision.verdict === "allowed" &&
    typeof decision.sideEffect === "string" &&
    decision.sideEffect.startsWith("identity.alias.")
  );
}
function clone(v: ContactAliasStateV1): ContactAliasStateV1 {
  return structuredClone(v);
}

export class InMemoryContactAliasRepositoryV1 implements ContactAliasRepositoryV1 {
  readonly retention = "memory_only" as const;
  #state: ContactAliasStateV1 | null = null;

  read(decision: PolicyDecision): ContactAliasStateV1 | null {
    if (!isAuthentic(decision)) throw new ContactAliasDecisionMismatchError();
    return this.#state === null ? null : clone(this.#state);
  }
  replace(
    next: ContactAliasStateV1,
    decision: PolicyDecision,
  ): ContactAliasRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new ContactAliasDecisionMismatchError();
    if (next.persistenceClass === "null") {
      this.#state = null;
      return {
        outcome: "discarded",
        retention: "memory_only",
        reasonCode: "null_persistence_class",
      };
    }
    this.#state = clone(next);
    return { outcome: "written", retention: "memory_only", reasonCode: "memory_only" };
  }
  clear(decision: PolicyDecision): ContactAliasRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new ContactAliasDecisionMismatchError();
    const had = this.#state !== null;
    this.#state = null;
    return {
      outcome: had ? "cleared" : "nothing_to_clear",
      retention: "memory_only",
      reasonCode: "cleared",
    };
  }
}

export class NullContactAliasRepositoryV1 implements ContactAliasRepositoryV1 {
  readonly retention = "null" as const;
  read(decision: PolicyDecision): ContactAliasStateV1 | null {
    if (!isAuthentic(decision)) throw new ContactAliasDecisionMismatchError();
    return null;
  }
  replace(
    _next: ContactAliasStateV1,
    decision: PolicyDecision,
  ): ContactAliasRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new ContactAliasDecisionMismatchError();
    return { outcome: "discarded", retention: "null", reasonCode: "null_repository" };
  }
  clear(decision: PolicyDecision): ContactAliasRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new ContactAliasDecisionMismatchError();
    return { outcome: "nothing_to_clear", retention: "null", reasonCode: "null_repository" };
  }
}
