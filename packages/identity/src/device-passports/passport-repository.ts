/**
 * Device Passport retention (TECH-ID-08). Current-process memory or Null ONLY —
 * never persistent, never a server registry, never a device-list, never
 * exported. Every operation requires an authentic `identity.device_link_request.*`
 * or `identity.device_passport.*`-scoped decision. The in-memory store defensively
 * clones; the null store retains nothing. No serialization helper intended for
 * external transport exists.
 */

import { isPolicyDecision, type PolicyDecision } from "@freelayer/privacy";
import { DevicePassportDecisionMismatchError } from "./passport-errors";
import type { DevicePassportStateV1 } from "./passport-types";

export interface DevicePassportRepositoryWriteResultV1 {
  readonly outcome: "stored" | "discarded";
  readonly persistenceClass: "current_process_memory" | "null";
}
export interface DevicePassportRepositoryClearResultV1 {
  readonly outcome: "cleared";
}

export interface DevicePassportRepositoryV1 {
  replace(
    state: DevicePassportStateV1,
    decision: PolicyDecision,
  ): DevicePassportRepositoryWriteResultV1;
  read(decision: PolicyDecision): DevicePassportStateV1 | null;
  clear(decision: PolicyDecision): DevicePassportRepositoryClearResultV1;
}

function isAuthentic(decision: PolicyDecision): boolean {
  return (
    isPolicyDecision(decision) &&
    decision.verdict === "allowed" &&
    typeof decision.sideEffect === "string" &&
    (decision.sideEffect.startsWith("identity.device_link_request.") ||
      decision.sideEffect.startsWith("identity.device_passport."))
  );
}
function clone(v: DevicePassportStateV1): DevicePassportStateV1 {
  return structuredClone(v);
}

export class InMemoryDevicePassportRepositoryV1 implements DevicePassportRepositoryV1 {
  #state: DevicePassportStateV1 | null = null;

  replace(
    state: DevicePassportStateV1,
    decision: PolicyDecision,
  ): DevicePassportRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new DevicePassportDecisionMismatchError();
    this.#state = clone(state);
    return { outcome: "stored", persistenceClass: "current_process_memory" };
  }
  read(decision: PolicyDecision): DevicePassportStateV1 | null {
    if (!isAuthentic(decision)) throw new DevicePassportDecisionMismatchError();
    return this.#state === null ? null : clone(this.#state);
  }
  clear(decision: PolicyDecision): DevicePassportRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new DevicePassportDecisionMismatchError();
    this.#state = null;
    return { outcome: "cleared" };
  }
}

export class NullDevicePassportRepositoryV1 implements DevicePassportRepositoryV1 {
  replace(
    _state: DevicePassportStateV1,
    decision: PolicyDecision,
  ): DevicePassportRepositoryWriteResultV1 {
    if (!isAuthentic(decision)) throw new DevicePassportDecisionMismatchError();
    return { outcome: "discarded", persistenceClass: "null" };
  }
  read(decision: PolicyDecision): DevicePassportStateV1 | null {
    if (!isAuthentic(decision)) throw new DevicePassportDecisionMismatchError();
    return null;
  }
  clear(decision: PolicyDecision): DevicePassportRepositoryClearResultV1 {
    if (!isAuthentic(decision)) throw new DevicePassportDecisionMismatchError();
    return { outcome: "cleared" };
  }
}
