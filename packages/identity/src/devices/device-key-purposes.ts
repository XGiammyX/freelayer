/**
 * Device key-purpose separation (TECH-ID-07). Each future key slot has EXACTLY
 * one purpose. Reuse across purposes is forbidden by default; the purpose cannot
 * change after activation; signing / encryption / storage-wrapping / linking are
 * distinct roles. No algorithm is selected here (Gate F). Declaring a purpose
 * does NOT imply the purpose will necessarily be implemented. Unknown purpose
 * denies.
 */

export type DeviceKeyPurposeV1 =
  | "device_authorization_signing_future"
  | "identity_assertion_signing_future"
  | "pairwise_messaging_future"
  | "room_messaging_future"
  | "local_storage_wrapping_future"
  | "device_linking_future";

export const DEVICE_KEY_PURPOSES: readonly DeviceKeyPurposeV1[] = [
  "device_authorization_signing_future",
  "identity_assertion_signing_future",
  "pairwise_messaging_future",
  "room_messaging_future",
  "local_storage_wrapping_future",
  "device_linking_future",
];

export function isDeviceKeyPurposeV1(value: unknown): value is DeviceKeyPurposeV1 {
  return typeof value === "string" && DEVICE_KEY_PURPOSES.includes(value as DeviceKeyPurposeV1);
}
