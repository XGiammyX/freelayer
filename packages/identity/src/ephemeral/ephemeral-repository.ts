/**
 * Ephemeral identity repositories (TECH-ID-04). CURRENT-PROCESS MEMORY or NULL —
 * never persistent-capable. Process-epoch bound (a read under a different epoch
 * returns null — no restart restoration). Deep defensive clones; no shared global
 * state; explicit clear; no hidden recovery snapshot; no serialization helper.
 * Every operation requires an authentic `identity.ephemeral.*`-scoped decision.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { EphemeralIdentityDecisionMismatchError } from "./ephemeral-errors";
import type { IdentityProcessEpochId } from "./ephemeral-clock";
import type { EphemeralIdentityVaultStateV1 } from "./ephemeral-types";

export interface EphemeralIdentityRepositoryWriteResultV1 {
  readonly outcome: "written" | "discarded";
  readonly retention: "current_process_memory" | "null";
  readonly reasonCode: string;
}
export interface EphemeralIdentityRepositoryDestroyResultV1 {
  readonly outcome: "destroyed" | "nothing_to_destroy";
  readonly retention: "current_process_memory" | "null";
  readonly reasonCode: string;
}
export interface EphemeralIdentityRepositoryClearResultV1 {
  readonly outcome: "cleared" | "nothing_to_clear";
  readonly retention: "current_process_memory" | "null";
  readonly reasonCode: string;
}

export interface EphemeralIdentityRepositoryV1 {
  readonly retention: "current_process_memory" | "null";
  readonly crossRestartValidity: false;
  readCurrent(
    currentProcessEpochId: IdentityProcessEpochId,
    decision: PolicyDecision,
  ): EphemeralIdentityVaultStateV1 | null;
  replaceCurrent(
    next: EphemeralIdentityVaultStateV1,
    decision: PolicyDecision,
  ): EphemeralIdentityRepositoryWriteResultV1;
  destroyCurrent(
    currentProcessEpochId: IdentityProcessEpochId,
    decision: PolicyDecision,
  ): EphemeralIdentityRepositoryDestroyResultV1;
  clearAll(decision: PolicyDecision): EphemeralIdentityRepositoryClearResultV1;
}

function isAuthentic(decision: PolicyDecision): boolean {
  return (
    isPolicyDecision(decision) &&
    decision.verdict === "allowed" &&
    typeof decision.sideEffect === "string" &&
    decision.sideEffect.startsWith("identity.ephemeral.")
  );
}

function clone(v: EphemeralIdentityVaultStateV1): EphemeralIdentityVaultStateV1 {
  return structuredClone(v);
}

export class InMemoryEphemeralIdentityRepositoryV1 implements EphemeralIdentityRepositoryV1 {
  readonly retention = "current_process_memory" as const;
  readonly crossRestartValidity = false as const;
  #vault: EphemeralIdentityVaultStateV1 | null = null;

  readCurrent(
    currentProcessEpochId: IdentityProcessEpochId,
    decision: PolicyDecision,
  ): EphemeralIdentityVaultStateV1 | null {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    if (this.#vault === null) return null;
    // Epoch mismatch = operationally expired; never restore across epochs.
    if (this.#vault.processBinding.processEpochId !== currentProcessEpochId) return null;
    return clone(this.#vault);
  }

  replaceCurrent(
    next: EphemeralIdentityVaultStateV1,
    decision: PolicyDecision,
  ): EphemeralIdentityRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    if (next.persistenceClass === "null") {
      this.#vault = null;
      return {
        outcome: "discarded",
        retention: "current_process_memory",
        reasonCode: "null_persistence_class",
      };
    }
    this.#vault = clone(next);
    return { outcome: "written", retention: "current_process_memory", reasonCode: "memory_only" };
  }

  destroyCurrent(
    currentProcessEpochId: IdentityProcessEpochId,
    decision: PolicyDecision,
  ): EphemeralIdentityRepositoryDestroyResultV1 {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    const had =
      this.#vault !== null && this.#vault.processBinding.processEpochId === currentProcessEpochId;
    this.#vault = null;
    return {
      outcome: had ? "destroyed" : "nothing_to_destroy",
      retention: "current_process_memory",
      reasonCode: "cleared",
    };
  }

  clearAll(decision: PolicyDecision): EphemeralIdentityRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    const had = this.#vault !== null;
    this.#vault = null;
    return {
      outcome: had ? "cleared" : "nothing_to_clear",
      retention: "current_process_memory",
      reasonCode: "cleared",
    };
  }
}

/** Retains nothing; never claims continuity or recoverability. */
export class NullEphemeralIdentityRepositoryV1 implements EphemeralIdentityRepositoryV1 {
  readonly retention = "null" as const;
  readonly crossRestartValidity = false as const;

  readCurrent(
    _epoch: IdentityProcessEpochId,
    decision: PolicyDecision,
  ): EphemeralIdentityVaultStateV1 | null {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    return null;
  }
  replaceCurrent(
    _next: EphemeralIdentityVaultStateV1,
    decision: PolicyDecision,
  ): EphemeralIdentityRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    return { outcome: "discarded", retention: "null", reasonCode: "null_repository" };
  }
  destroyCurrent(
    _epoch: IdentityProcessEpochId,
    decision: PolicyDecision,
  ): EphemeralIdentityRepositoryDestroyResultV1 {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    return { outcome: "nothing_to_destroy", retention: "null", reasonCode: "null_repository" };
  }
  clearAll(decision: PolicyDecision): EphemeralIdentityRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new EphemeralIdentityDecisionMismatchError();
    return { outcome: "nothing_to_clear", retention: "null", reasonCode: "null_repository" };
  }
}
