// FIXTURE (not shipped): representative posture/governance violations the
// check:no-device-posture-or-governance-bypass guardrail must catch. Never imported.
/* eslint-disable */
// @ts-nocheck

export function bad(state, posture, policy) {
  // Posture elevation / provider integration.
  const p = { providerIntegrated: true, trustedForElevation: true, effectivePosture: "hardened" };
  elevateDevicePosture(posture);
  // Posture as identity / authority.
  const a = { postureAsIdentity: true, postureGrantsMembership: true, postureAuthorizes: true };
  // Endpoint grants / active protection claims.
  const e = { endpointGrantsAccess: true, activeProtectionClaim: true, screenShieldActive: true };
  // Direct room-policy mutation / loosening / lowering.
  state.policyDocument.metadata.actorRefsAllowed = true;
  loosenRoomPolicy(policy);
  lowerMinimumDevicePosture(policy);
  const cmd = { command: "room.policy.loosen" };
  // Persistence / telemetry.
  persistDevicePosture(posture);
  const cache = { devicePostureCache: posture, postureHistory: [] };
  reportDevicePosture(posture);
  return { p, a, e, cmd, cache };
}

// Device-management / attestation / anti-spyware imports.
import DeviceInfo from "react-native-device-info";
import { PlayIntegrity } from "play-integrity";
