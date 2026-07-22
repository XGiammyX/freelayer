// FIXTURE (not shipped): per-contact alias bypasses the
// check-no-contact-alias-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

export function bad(alias, relationship) {
  // Alias as authority / verification.
  const ctx = { aliasVerified: true, trustFromAlias: true };
  if (aliasGrantsAccess(alias)) return true;
  // Global username + directory + search.
  const u = { globalUsername: "@alice", publicUsername: "alice" };
  const dir = new usernameDirectory();
  searchAlias("alice");
  lookupAlias("bob");
  findByAlias("carol");
  discoverByPhone("+1555");
  // Root id exposed + transfer + merge.
  const r = { rootIdAsAlias: "idr-x" };
  transferAlias(alias, relationship);
  mergeContactsByAlias(alias);
  // Local peer label shared remotely + exchange + crypto.
  shareLocalPeerLabel(alias);
  const shared = { peerShared: true };
  exchangeAlias(alias);
  signAlias(alias);
  const sig = { aliasSignature: "MEUC..." };
  // Spoofing-prevention claim + ScreenShield + history.
  const claim = { spoofProof: true, screenShieldActive: true };
  persistAliasHistory(alias);
  // Generic patch + persistent storage + logging + network.
  const patch = { command: "identity.alias.patch" };
  localStorage.setItem("alias", JSON.stringify(alias));
  console.log("alias", alias.displayText);
  fetch("https://example.com/alias?label=" + alias.labelText);
  return { ctx, u, dir, r, shared, sig, claim, patch };
}
