// FIXTURE (not shipped): representative membership/capability violations the
// check:no-room-membership-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

export function bad(state, role, descriptor, capability) {
  // Direct membership projection mutation.
  state.membershipRecords.push({ role: "owner_placeholder" });
  // Role-string used for authorization outside the membership package.
  if (role === "owner_placeholder") return true;
  // Caller-controlled authority/trust fields.
  const ctx = { isAdmin: true, isOwner: true, trustedDevice: true, endpointSafe: true };
  // Wildcard permissions.
  const perms = { capabilities: ["*"], capability: "*" };
  const loosen = "room.policy.loosen";
  // Capability serialization / persistence / delegation.
  const blob = JSON.stringify(descriptor);
  const s = JSON.stringify(capability);
  delegateCapability(descriptor);
  exportCapability(descriptor);
  const cache = { capabilityCache: descriptor };
  // Invites / presence / contact.
  const invite = { inviteUrl: "x", inviteCode: "y", lastSeen: 1, onlineStatus: "on" };
  // Network / crypto.
  fetch("https://example.com/authz");
  return { ctx, perms, loosen, blob, s, cache, invite };
}

// Auth/identity dependencies.
import jwt from "jsonwebtoken";
import { OpenFGA } from "@openfga/sdk";
import * as crypto from "node:crypto";
