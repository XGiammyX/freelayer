/**
 * Device-key-model test helpers (TECH-ID-07). SYNTHETIC only — no real hardware
 * ids, serials, key bytes, or secrets. Deterministic ids + injected clock.
 */

import {
  issuePolicyDecision,
  type PolicySideEffectScope,
  type PrivacyMode,
} from "@freelayer/privacy";
import {
  applyDeviceKeyModelCommandV1,
  emptyDeviceKeyModelStateV1,
  InMemoryDeviceKeyModelRepositoryV1,
  validateDeviceAuthorizationId,
  validateDeviceKeySlotId,
  validateIdentityPersonaId,
  validateLocalDeviceRef,
  validateLocalIdentityRootId,
  type DeviceAuthorizationScopeV1,
  type DeviceGeneratedIdsV1,
  type DeviceKeyModelRepositoryV1,
  type DeviceKeyModelStateV1,
  type DeviceRootRefV1,
} from "@freelayer/identity";

export const DEVICE_SENTINEL = "FREELAYER_DEVICE_KEY_MODEL_SENTINEL_DO_NOT_LEAK";
export const CLOCK = "local:0";

export const ROOT = validateLocalIdentityRootId("idr-dev-1");
export const PERSONA = validateIdentityPersonaId("idp-dev-1");

export function rootRef(over?: Partial<DeviceRootRefV1>): DeviceRootRefV1 {
  return {
    rootId: ROOT,
    rootKind: "long_lived_local",
    rootRevision: 1 as DeviceRootRefV1["rootRevision"],
    rootActive: true,
    rootCompromised: false,
    ...over,
  };
}

export function rootScope(readOnly = false): DeviceAuthorizationScopeV1 {
  return { kind: "identity_root", rootId: ROOT, readOnly };
}
export function personaScope(): DeviceAuthorizationScopeV1 {
  return { kind: "persona", rootId: ROOT, personaId: PERSONA, readOnly: false };
}
export function readOnlyScope(): DeviceAuthorizationScopeV1 {
  return { kind: "read_only", rootId: ROOT, readOnly: true };
}

let seq = 0;
export function nextIds(slotCount = 1): Required<DeviceGeneratedIdsV1> {
  seq += 1;
  const keySlotIds = Array.from({ length: slotCount }, (_v, i) =>
    validateDeviceKeySlotId(`devslot-a${seq}-${i + 1}`),
  );
  return {
    deviceRef: validateLocalDeviceRef(`dev-a${seq}`),
    authorizationId: validateDeviceAuthorizationId(`devauth-a${seq}`),
    keySlotIds,
  };
}

export function emptyState(pc: "memory_only" | "null" = "memory_only"): DeviceKeyModelStateV1 {
  return emptyDeviceKeyModelStateV1(pc);
}
export function repo(): DeviceKeyModelRepositoryV1 {
  return new InMemoryDeviceKeyModelRepositoryV1();
}
export function decisionFor(scope: PolicySideEffectScope, mode: PrivacyMode = "standard") {
  return issuePolicyDecision("persistence", "allowed", mode, scope);
}

export function bootstrapCommand(over?: {
  scope?: DeviceAuthorizationScopeV1;
  capabilities?: readonly string[];
  keySlotPurposes?: readonly string[];
  rootId?: string;
  expectedRootRevision?: number;
}) {
  return {
    schemaVersion: 1,
    command: "identity.device.bootstrap_current_installation_placeholder",
    rootId: over?.rootId ?? (ROOT as unknown as string),
    expectedRootRevision: over?.expectedRootRevision ?? 1,
    scope: over?.scope ?? personaScope(),
    capabilities: over?.capabilities ?? [
      "identity.summary.read",
      "identity.persona.use",
      "identity.device.restrict",
      "identity.device.revoke",
    ],
    keySlotPurposes: over?.keySlotPurposes ?? ["device_authorization_signing_future"],
  };
}

export function applyD(input: {
  state: DeviceKeyModelStateV1;
  command: unknown;
  scope: PolicySideEffectScope;
  mode?: PrivacyMode;
  rootRef?: DeviceRootRefV1;
  generatedIds?: DeviceGeneratedIdsV1;
  repository?: DeviceKeyModelRepositoryV1;
}) {
  return applyDeviceKeyModelCommandV1({
    state: input.state,
    command: input.command,
    mode: input.mode ?? "standard",
    decision: decisionFor(input.scope, input.mode ?? "standard"),
    ...(input.rootRef !== undefined ? { rootRef: input.rootRef } : {}),
    generatedIds: input.generatedIds ?? {},
    clockValue: CLOCK,
    repository: input.repository ?? repo(),
  });
}

/** Bootstrap the current-installation placeholder; returns state + ids. */
export function bootstrapped(over?: Parameters<typeof bootstrapCommand>[0]): {
  state: DeviceKeyModelStateV1;
  authorizationId: ReturnType<typeof validateDeviceAuthorizationId>;
  deviceRef: ReturnType<typeof validateLocalDeviceRef>;
} {
  const purposes = over?.keySlotPurposes ?? ["device_authorization_signing_future"];
  const ids = nextIds(purposes.length);
  const state = applyD({
    state: emptyState(),
    command: bootstrapCommand(over),
    scope: "identity.device.bootstrap",
    rootRef: rootRef(),
    generatedIds: ids,
  }).state;
  return { state, authorizationId: ids.authorizationId, deviceRef: ids.deviceRef };
}
