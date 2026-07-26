// FIXTURE (not shipped): device-passport bypasses the
// check-no-device-passport-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck
import { createSign } from "node:crypto";

export function bad(passport, request, root, room) {
  // Passport marked generically valid/trusted/verified + future states.
  const p = {
    passportValid: true,
    passportVerified: true,
    cryptographicallyIssued: true,
    remotelyAccepted: true,
  };
  const life = { lifecycle: "issued_future_signed" };
  const life2 = { lifecycle: "accepted_future_verified" };
  // Local approval granting operational authority + second device.
  const auth = { operationalAuthority: "granted", grantsOperationalAuthority: true };
  approvalActivatesDevice(passport);
  activateLinkedDevice(passport);
  createSecondActiveDevice(root);
  // Root-secret / history transfer.
  const t = { rootSecretTransferAllowed: true, historyTransferIncluded: true };
  transferRootSecret(root);
  transferHistory(passport);
  // QR / serialization + posture/attestation authority + room approver.
  encodePassportQr(passport);
  scanPassportQr("payload");
  const claim = { devicePostureClaimIncluded: true, attestationClaimIncluded: true };
  roomRoleApprovesPassport(room);
  // Widening + wildcard + delegation + recovery.
  widenPassportScope(passport);
  const grant = {
    delegationAllowed: true,
    recoveryAuthorityGranted: true,
    wildcardCapability: true,
  };
  // Registry + remote revocation + ScreenShield + patch.
  persistPassportRegistry(passport);
  remotePassportRevoke(passport);
  const rev = { cryptographicRevocationPerformed: true, screenShieldActive: true };
  const patch = { command: "identity.device_passport.patch" };
  // Real crypto + camera + logging + network + storage.
  createSign("sha256");
  const cam = navigator.mediaDevices.getUserMedia({ video: true });
  console.log("passport claim", passport.claims);
  fetch("https://example.com/passport?id=" + passport.passportId);
  localStorage.setItem("passport", JSON.stringify(passport));
  return { p, life, life2, auth, t, claim, grant, rev, patch, cam };
}
