/**
 * Device-key-model retention (TECH-ID-07). Memory or Null ONLY — never persistent
 * plaintext, never a database, never a hidden key store, never a serialized
 * device list, never persistent label history, never hardware-identifier
 * collection. Stores only authorization metadata + EMPTY key-slot descriptors.
 * Every operation requires an authentic `identity.device.*`-scoped decision. The
 * in-memory store defensively clones; the null store retains nothing.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { DeviceAuthorizationDecisionMismatchError } from "./device-errors";
import type { DeviceKeyModelStateV1 } from "./device-types";

export interface DeviceRepositoryWriteResultV1 {
  readonly outcome: "stored" | "discarded";
  readonly persistenceClass: "memory_only" | "null";
}
export interface DeviceRepositoryClearResultV1 {
  readonly outcome: "cleared";
}

export interface DeviceKeyModelRepositoryV1 {
  replace(state: DeviceKeyModelStateV1, decision: PolicyDecision): DeviceRepositoryWriteResultV1;
  read(decision: PolicyDecision): DeviceKeyModelStateV1 | null;
  clear(decision: PolicyDecision): DeviceRepositoryClearResultV1;
}

function isAuthentic(decision: PolicyDecision): boolean {
  return (
    isPolicyDecision(decision) &&
    decision.verdict === "allowed" &&
    typeof decision.sideEffect === "string" &&
    decision.sideEffect.startsWith("identity.device.")
  );
}
function clone(v: DeviceKeyModelStateV1): DeviceKeyModelStateV1 {
  return structuredClone(v);
}

export class InMemoryDeviceKeyModelRepositoryV1 implements DeviceKeyModelRepositoryV1 {
  #state: DeviceKeyModelStateV1 | null = null;

  replace(state: DeviceKeyModelStateV1, decision: PolicyDecision): DeviceRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new DeviceAuthorizationDecisionMismatchError();
    this.#state = clone(state);
    return { outcome: "stored", persistenceClass: "memory_only" };
  }
  read(decision: PolicyDecision): DeviceKeyModelStateV1 | null {
    if (!isAuthentic(decision)) throw new DeviceAuthorizationDecisionMismatchError();
    return this.#state === null ? null : clone(this.#state);
  }
  clear(decision: PolicyDecision): DeviceRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new DeviceAuthorizationDecisionMismatchError();
    this.#state = null;
    return { outcome: "cleared" };
  }
}

export class NullDeviceKeyModelRepositoryV1 implements DeviceKeyModelRepositoryV1 {
  replace(_state: DeviceKeyModelStateV1, decision: PolicyDecision): DeviceRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new DeviceAuthorizationDecisionMismatchError();
    return { outcome: "discarded", persistenceClass: "null" };
  }
  read(decision: PolicyDecision): DeviceKeyModelStateV1 | null {
    if (!isAuthentic(decision)) throw new DeviceAuthorizationDecisionMismatchError();
    return null;
  }
  clear(decision: PolicyDecision): DeviceRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new DeviceAuthorizationDecisionMismatchError();
    return { outcome: "cleared" };
  }
}
