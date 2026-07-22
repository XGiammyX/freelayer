// FIXTURE (not shipped): ephemeral-identity bypasses the
// check-no-ephemeral-identity-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

let currentEphemeralIdentity = null;
const globalEphemeralIdentity = {};

export function bad(root) {
  // Boolean model + parent link.
  const e = { ephemeral: true, parentRootId: "idr-long", longLivedRootId: "idr-long" };
  // Promotion / conversion.
  promoteToLongLived(root);
  convertToLongLived(root);
  // Recovery / export / sync / extension.
  enableRecovery(root);
  const kit = { recoveryPhrase: "a b c", recoveryKey: "k" };
  exportEphemeral(root);
  synchronizeEphemeral(root);
  extendLifetime(root, 999999);
  // Background timer as enforcement.
  setInterval(() => {}, 1000);
  setTimeout(() => {}, 1000);
  // Anonymity / trust claims + crypto.
  const claim = {
    anonymous: true,
    unlinkable: true,
    verified: true,
    privateKey: "x",
    publicKey: "y",
  };
  // Posture-as-identity + erasure guarantee + remote delete.
  const p = {
    devicePostureAsIdentity: true,
    screenShieldActive: true,
    forensicErasureGuaranteed: true,
  };
  secureErase(root);
  remoteDelete(root);
  // Persistent storage + network.
  localStorage.setItem("ephemeral", JSON.stringify(root));
  fetch("https://example.com/ephemeral?root=" + root);
  return { e, kit, claim, p };
}
