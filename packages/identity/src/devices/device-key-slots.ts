/**
 * Device key-slot descriptor (TECH-ID-07). A slot is a TYPED PLACEHOLDER for one
 * future key purpose — it holds NO key material: no public/private bytes, no
 * hash, no fingerprint, no algorithm. `algorithm` is "not_selected_gate_f".
 * Current production may create only `reserved_not_generated` slots. Real key
 * generation is Gate F.
 */

import type { IdentityLocalRevision } from "../identifiers";
import type { DeviceAuthorizationId, DeviceKeySlotId, LocalDeviceRef } from "./device-identifiers";
import type { DeviceKeyPurposeV1 } from "./device-key-purposes";

export type DeviceKeySlotLifecycleV1 =
  | "reserved_not_generated"
  | "active_future"
  | "rotation_required_future"
  | "compromised_suspected"
  | "revoked_tombstone";

export const DEVICE_KEY_SLOT_LIFECYCLES: readonly DeviceKeySlotLifecycleV1[] = [
  "reserved_not_generated",
  "active_future",
  "rotation_required_future",
  "compromised_suspected",
  "revoked_tombstone",
];

export interface DeviceKeySlotV1 {
  readonly schemaVersion: 1;
  readonly slotId: DeviceKeySlotId;
  readonly deviceRef: LocalDeviceRef;
  readonly authorizationId: DeviceAuthorizationId;
  readonly purpose: DeviceKeyPurposeV1;
  readonly lifecycle: DeviceKeySlotLifecycleV1;
  readonly revision: IdentityLocalRevision;

  readonly algorithm: "not_selected_gate_f";
  readonly publicMaterialPresent: false;
  readonly privateMaterialPresent: false;
  readonly hardwareBacked: "unknown_not_assessed";
  readonly exportability: "not_applicable_no_material";
  readonly keyReuseAcrossPurposes: "forbidden";

  readonly createdAtLocal: string;
  readonly updatedAtLocal: string;
}
