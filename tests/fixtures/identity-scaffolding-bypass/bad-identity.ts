// FIXTURE (not shipped): representative identity-scaffolding bypasses the
// check-no-identity-scaffolding-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

import { resolveDid } from "did-resolver";
import jwt from "did-jwt";

// Ambient / global current identity.
let currentIdentity = null;
const globalIdentity = {};
const defaultPersona = {};

export function bad(vault) {
  // Key / recovery material in an identity record.
  const root = {
    privateKey: new Uint8Array(32),
    publicKey: "abc",
    seedPhrase: "correct horse battery staple",
    mnemonic: "x y z",
    recoveryPhrase: "a b c",
    keyBytes: [1, 2, 3],
  };
  // Phone / email / public username identity fields.
  const contact = { phoneNumber: "+15551234", emailAddress: "a@b.com", publicHandle: "@alice" };
  // Caller-controlled trust.
  const ctx = { verified: true, trusted: true, isOwner: true, isAdmin: true };
  // Device key material.
  const dev = { devicePrivateKey: "k", devicePassportSignature: "s" };
  // In-place mutation of identity collections.
  vault.roots.push(root);
  vault.personas.push({});
  vault.relationships.push({});
  vault.roomBindings.push({});
  // Persistent storage.
  localStorage.setItem("identity", JSON.stringify(vault));
  window.indexedDB.open("identity");
  // DID resolution + generic patch + posture-as-identity.
  resolveDid("did:example:123");
  const patch = { command: "identity.patch" };
  const posture = { postureGrantsIdentity: true, devicePostureVerifiesIdentity: true };
  // Network + raw logging with identity.
  fetch("https://example.com/identity?root=" + root);
  console.log("identity vault", vault);
  return { root, contact, ctx, dev, patch, posture };
}
