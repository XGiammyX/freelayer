/**
 * The write barrier (TECH-05, ADR-0005).
 *
 * Every storage operation must present: the concrete request, a valid
 * PolicyDecision scoped to EXACTLY that operation, and the resolved
 * StoragePolicy. Anything less is a bypass attempt. Default is deny;
 * "generic" decisions are NOT accepted here.
 *
 * Errors never contain stored values (see errors.ts redaction rule).
 */

import { isPolicyDecision, type PolicyCapability, type PolicyDecision } from "@freelayer/privacy";
import { STORAGE_BACKEND_CAPABILITIES } from "./backends";
import {
  PLAINTEXT_RESTRICTED_SENSITIVITIES,
  type StorageDeleteRequest,
  type StorageOperationKind,
  type StorageReadRequest,
  type StorageWriteRequest,
} from "./operations";
import type { StoragePolicy } from "./policy";
import {
  ForbiddenCacheWriteError,
  ForbiddenDebugArtifactError,
  ForbiddenPersistentWriteError,
  StorageBackendNotImplementedError,
  StorageBypassAttemptError,
  StoragePolicyDeniedError,
} from "./errors";

/** Cache operations authorize via the mediaCache capability; all else via persistence. */
function expectedCapability(operation: StorageOperationKind): PolicyCapability {
  return operation === "storage.cache.write" || operation === "storage.cache.read"
    ? "mediaCache"
    : "persistence";
}

/** Shared decision validation: presence, verdict, capability, exact side-effect scope. */
function assertDecisionValid(
  decision: PolicyDecision,
  operation: StorageOperationKind,
  policy: StoragePolicy,
): void {
  if (!isPolicyDecision(decision)) {
    throw new StorageBypassAttemptError(
      "operation invoked without a valid PolicyDecision (ADR-0002)",
    );
  }
  if (decision.verdict !== "allowed") {
    throw new StoragePolicyDeniedError({
      operation,
      dataClass: policy.dataClass,
      detail: "policy decision verdict is denied",
    });
  }
  const capability = expectedCapability(operation);
  if (decision.capability !== capability) {
    throw new StorageBypassAttemptError(
      `decision capability "${decision.capability}" does not match required "${capability}"`,
    );
  }
  if (decision.sideEffect !== operation) {
    throw new StorageBypassAttemptError(
      `decision side-effect "${decision.sideEffect}" does not match operation "${operation}"`,
    );
  }
}

/** The backend named by policy must exist; the placeholder throws by design. */
function assertBackendUsable(policy: StoragePolicy): void {
  const capability = STORAGE_BACKEND_CAPABILITIES[policy.backend];
  if (!capability.implemented) {
    throw new StorageBackendNotImplementedError();
  }
}

export function assertStorageWriteAllowed(
  request: StorageWriteRequest,
  decision: PolicyDecision,
  policy: StoragePolicy,
): void {
  assertDecisionValid(decision, request.operation, policy);

  if (!policy.allowWrite) {
    throw new StoragePolicyDeniedError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: policy.reason,
    });
  }

  if (request.operation === "storage.cache.write" && !policy.allowCache) {
    throw new ForbiddenCacheWriteError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: policy.reason,
    });
  }

  if (request.dataClass === "debug_artifact" && !policy.allowDebugArtifacts) {
    throw new ForbiddenDebugArtifactError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: "debug artifacts are denied in v0",
    });
  }

  // Logs and audit events must never carry content-grade payloads.
  if (
    (request.dataClass === "logs" || request.operation === "storage.audit.write") &&
    PLAINTEXT_RESTRICTED_SENSITIVITIES.includes(request.sensitivity)
  ) {
    throw new ForbiddenDebugArtifactError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: "logs/audit events must not contain content or key material",
    });
  }

  assertBackendUsable(policy);

  const backend = STORAGE_BACKEND_CAPABILITIES[policy.backend];
  if (backend.persistent && !policy.persistentAllowed) {
    throw new ForbiddenPersistentWriteError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: "persistent writes are not allowed by the active policy",
    });
  }
  if (
    backend.persistent &&
    !policy.plaintextAllowed &&
    PLAINTEXT_RESTRICTED_SENSITIVITIES.includes(request.sensitivity)
  ) {
    throw new ForbiddenPersistentWriteError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: "plaintext-sensitive payloads may not reach a persistent backend",
    });
  }
}

export function assertStorageReadAllowed(
  request: StorageReadRequest,
  decision: PolicyDecision,
  policy: StoragePolicy,
): void {
  assertDecisionValid(decision, request.operation, policy);
  if (!policy.allowRead) {
    throw new StoragePolicyDeniedError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: policy.reason,
    });
  }
  if (request.operation === "storage.cache.read" && !policy.allowCache) {
    throw new ForbiddenCacheWriteError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: policy.reason,
    });
  }
  assertBackendUsable(policy);
}

export function assertStorageDeleteAllowed(
  request: StorageDeleteRequest,
  decision: PolicyDecision,
  policy: StoragePolicy,
): void {
  assertDecisionValid(decision, request.operation, policy);
  if (!policy.allowDelete) {
    throw new StoragePolicyDeniedError({
      operation: request.operation,
      dataClass: request.dataClass,
      detail: policy.reason,
    });
  }
  assertBackendUsable(policy);
}

/** list/clear share management validation; op-specific flag checked by caller-facing wrappers. */
export function assertStorageManagementAllowed(
  operation: "storage.list" | "storage.clear",
  decision: PolicyDecision,
  policy: StoragePolicy,
): void {
  assertDecisionValid(decision, operation, policy);
  const allowed = operation === "storage.list" ? policy.allowList : policy.allowDelete;
  if (!allowed) {
    throw new StoragePolicyDeniedError({
      operation,
      dataClass: policy.dataClass,
      detail: policy.reason,
    });
  }
  assertBackendUsable(policy);
}
