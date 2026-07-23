// FIXTURE (not shipped): device-key-model bypasses the
// check-no-device-key-model-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck
import { generateKeyPair } from "node:crypto";

export function bad(device, root, room) {
  // DevicePosture / RoomOS role as device authority.
  const a = { postureAuthorizesDevice: true, roleGrantsDevice: true };
  if (membershipAuthorizesDevice(device)) return true;
  // Trusted / verified / primary booleans + global singleton.
  const t = { trustedDevice: true, verifiedDevice: true, primaryDevice: true };
  const cur = getCurrentDevice();
  const sing = new globalCurrentDevice();
  // Wildcard scope + cross-purpose reuse + scope widening.
  const scope = { kind: "*", wildcardScope: true };
  const reuse = { keyReuseAcrossPurposes: "allowed" };
  reuseKeyAcrossPurposes(device);
  widenScope(scope);
  // Second device / linking / passport / attestation / copy root secret.
  addSecondDevice(root);
  linkDevice(device);
  approveDeviceQr("qr");
  issueDevicePassport(device);
  verifyDeviceAttestation(device);
  copyRootSecret(root);
  const p = { devicePassportVerified: true, hardwareAttested: true, attestationVerified: true };
  // Remote / cryptographic revocation + key rotation + erase.
  remoteDeviceRevoke(device);
  const rev = {
    cryptographicRevocationPerformed: true,
    messageKeysRotated: true,
    deviceDataErased: true,
  };
  // Persistent registry/history + hardware ids + ScreenShield.
  persistDeviceRegistry(device);
  const hw = { hardwareId: "abc", serialNumber: "xyz", screenShieldActive: true };
  // Real key generation + hardware probe + logging + network + storage.
  generateKeyPair("ed25519", {}, () => {});
  const ua = navigator.userAgent;
  console.log("device label", device.label);
  fetch("https://example.com/device?id=" + device.deviceRef);
  localStorage.setItem("device", JSON.stringify(device));
  const patch = { command: "identity.device.patch" };
  return { a, t, cur, sing, scope, reuse, p, rev, hw, ua, patch };
}
