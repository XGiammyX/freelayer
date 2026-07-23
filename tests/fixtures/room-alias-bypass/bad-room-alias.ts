// FIXTURE (not shipped): per-room alias bypasses the
// check-no-room-alias-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

export function bad(alias, room, member) {
  // Alias as membership/role authority + verified member.
  const ctx = { verifiedMember: true, aliasVerified: true, authorityFromAlias: true };
  if (aliasGrantsRole(alias)) return true;
  if (aliasGrantsMembership(alias)) return true;
  const r = roleFromAlias(alias);
  // Root id / RoomMemberRef used as visible fallback.
  const fb = { rootIdAsRoomAlias: "idr-x", memberRefAsAlias: "member-y" };
  // Contact alias copied into room + shared/reused across rooms.
  copyContactAliasToRoom(alias, room);
  shareAliasAcrossRooms(alias);
  const s = { aliasSharedAcrossRooms: true };
  // Alias transfer + directory/search.
  transferRoomAlias(alias, room);
  moveAliasToBinding(alias);
  const dir = new roomAliasDirectory();
  roomAliasLookup("bob");
  searchRoomAlias("carol");
  // Persistent history/index + remote exchange + crypto.
  persistRoomAliasHistory(alias);
  const idx = new roomAliasCollisionIndex();
  exchangeRoomAlias(alias);
  signRoomAlias(alias);
  const sig = { roomAliasSignature: "MEUC..." };
  // Spoofing/unlinkability claims + ScreenShield + generic patch.
  const claim = { spoofProof: true, unlinkabilityGuaranteed: true, screenShieldActive: true };
  const patch = { command: "identity.room_alias.patch" };
  // Direct RoomOS membership mutation + storage + logging + network.
  setMembershipRole(member, "owner_placeholder");
  removeMembership(member);
  localStorage.setItem("roomAlias", JSON.stringify(alias));
  console.log("roomAlias", alias.displayText);
  fetch("https://example.com/room?alias=" + alias.roomAlias);
  return { ctx, r, fb, s, dir, idx, sig, claim, patch };
}
