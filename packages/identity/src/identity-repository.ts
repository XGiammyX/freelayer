/**
 * Local identity repositories (TECH-ID-03). MEMORY-ONLY or NULL — no disk, no
 * browser storage, no database, and no encrypted storage (encrypted persistence
 * is Gate F). Every operation requires an authentic identity-scoped
 * `PolicyDecision`. Defensive clones on read/write; no shared global state; no
 * logging. The Null repository retains nothing and never claims recoverability.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import {
  IdentityDecisionMismatchError,
  IdentityPersistenceUnavailableError,
} from "./identity-errors";
import type { LocalIdentityVaultStateV1 } from "./identity-types";

export interface LocalIdentityRepositoryWriteResultV1 {
  readonly outcome: "written" | "discarded";
  readonly retention: "memory_only" | "null";
  readonly reasonCode: string;
}

export interface LocalIdentityRepositoryClearResultV1 {
  readonly outcome: "cleared" | "nothing_to_clear";
  readonly retention: "memory_only" | "null";
  readonly reasonCode: string;
}

export interface LocalIdentityRepositoryV1 {
  readonly retention: "memory_only" | "null";
  readVault(decision: PolicyDecision): LocalIdentityVaultStateV1 | null;
  replaceVault(
    next: LocalIdentityVaultStateV1,
    decision: PolicyDecision,
  ): LocalIdentityRepositoryWriteResultV1;
  clear(decision: PolicyDecision): LocalIdentityRepositoryClearResultV1;
}

/** True iff the decision is authentic, allowed, and carries an identity scope. */
function isAuthenticIdentityDecision(decision: PolicyDecision): boolean {
  return (
    isPolicyDecision(decision) &&
    decision.verdict === "allowed" &&
    typeof decision.sideEffect === "string" &&
    decision.sideEffect.startsWith("identity.")
  );
}

/** Structural, side-effect-free deep clone (all identity data is JSON-shaped). */
function cloneVault(vault: LocalIdentityVaultStateV1): LocalIdentityVaultStateV1 {
  return structuredClone(vault);
}

/**
 * In-memory metadata-only store. Retains a defensive clone; a caller mutating the
 * value it passed in or the value it read back never affects stored state.
 */
export class InMemoryLocalIdentityRepositoryV1 implements LocalIdentityRepositoryV1 {
  readonly retention = "memory_only" as const;
  #vault: LocalIdentityVaultStateV1 | null = null;

  readVault(decision: PolicyDecision): LocalIdentityVaultStateV1 | null {
    if (!isAuthenticIdentityDecision(decision)) throw new IdentityDecisionMismatchError();
    return this.#vault === null ? null : cloneVault(this.#vault);
  }

  replaceVault(
    next: LocalIdentityVaultStateV1,
    decision: PolicyDecision,
  ): LocalIdentityRepositoryWriteResultV1 {
    if (!isAuthenticIdentityDecision(decision)) throw new IdentityDecisionMismatchError();
    if (next.persistenceClass === "null") {
      // A null-classed vault must never be retained, even in-memory.
      this.#vault = null;
      return {
        outcome: "discarded",
        retention: "memory_only",
        reasonCode: "null_persistence_class",
      };
    }
    this.#vault = cloneVault(next);
    return { outcome: "written", retention: "memory_only", reasonCode: "memory_only" };
  }

  clear(decision: PolicyDecision): LocalIdentityRepositoryClearResultV1 {
    if (!isAuthenticIdentityDecision(decision)) throw new IdentityDecisionMismatchError();
    const had = this.#vault !== null;
    this.#vault = null;
    return {
      outcome: had ? "cleared" : "nothing_to_clear",
      retention: "memory_only",
      reasonCode: "cleared",
    };
  }
}

/** Retains nothing. Honestly reports discard; never claims recoverability. */
export class NullLocalIdentityRepositoryV1 implements LocalIdentityRepositoryV1 {
  readonly retention = "null" as const;

  readVault(decision: PolicyDecision): LocalIdentityVaultStateV1 | null {
    if (!isAuthenticIdentityDecision(decision)) throw new IdentityDecisionMismatchError();
    return null;
  }

  replaceVault(
    _next: LocalIdentityVaultStateV1,
    decision: PolicyDecision,
  ): LocalIdentityRepositoryWriteResultV1 {
    if (!isAuthenticIdentityDecision(decision)) throw new IdentityDecisionMismatchError();
    return { outcome: "discarded", retention: "null", reasonCode: "null_repository" };
  }

  clear(decision: PolicyDecision): LocalIdentityRepositoryClearResultV1 {
    if (!isAuthenticIdentityDecision(decision)) throw new IdentityDecisionMismatchError();
    return { outcome: "nothing_to_clear", retention: "null", reasonCode: "null_repository" };
  }
}

/** Guard used by callers that require persistence to actually retain (memory). */
export function assertMemoryRetention(repo: LocalIdentityRepositoryV1): void {
  if (repo.retention !== "memory_only") throw new IdentityPersistenceUnavailableError();
}
