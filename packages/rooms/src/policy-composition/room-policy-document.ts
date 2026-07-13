/**
 * RoomPolicyDocument v1 (TECH-22) — the explicit, versioned, local room policy
 * that room governance can only TIGHTEN. All fields are conservative and
 * fail-closed; persistent plaintext is never allowed; external assets /
 * automatic previews / push / remote AI / telemetry are structurally `false`.
 * Governance loosening / voting / verified / distributed are structurally
 * unavailable (Gates F/G/H).
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalId } from "../room-types";
import type { MinimumDevicePostureV1 } from "./device-posture";
import type { ProtectedContentRequirementV1 } from "./protected-content";

export type RoomPolicyRevision = number & {
  readonly __roomPolicyRevision: unique symbol;
};

export const FIRST_ROOM_POLICY_REVISION = 1 as RoomPolicyRevision;

export type RoomSensitivityV1 = "normal" | "sensitive" | "high_sensitivity" | "critical";

export const ROOM_SENSITIVITIES: readonly RoomSensitivityV1[] = [
  "normal",
  "sensitive",
  "high_sensitivity",
  "critical",
];

export interface RoomPolicyDocumentV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly revision: RoomPolicyRevision;
  readonly sensitivity: RoomSensitivityV1;
  readonly minimumDevicePosture: MinimumDevicePostureV1;
  readonly protectedContentRequirement: ProtectedContentRequirementV1;

  readonly storage: {
    readonly maximumRetention: "null" | "memory_only" | "encrypted_future";
    readonly persistentPlaintextAllowed: false;
  };
  readonly network: {
    readonly networkAllowed: boolean;
    readonly directPeerAllowed: boolean;
    readonly externalAssetsAllowed: false;
    readonly automaticLinkPreviewsAllowed: false;
    readonly telemetryAllowed: false;
  };
  readonly metadata: {
    readonly receiptsAllowed: boolean;
    readonly typingAllowed: boolean;
    readonly presenceAllowed: boolean;
    readonly exactCountsAllowed: boolean;
    readonly exactTimestampsAllowed: boolean;
    readonly actorRefsAllowed: boolean;
  };
  readonly notifications: {
    readonly notificationAllowed: boolean;
    readonly contentPreviewAllowed: false;
    readonly pushAllowed: false;
  };
  readonly ai: {
    readonly localAiAllowed: boolean;
    readonly remoteAiAllowed: false;
  };
  readonly governance: {
    readonly looseningAllowed: false;
    readonly policyVotingAvailable: false;
    readonly verifiedGovernanceAvailable: false;
    readonly distributedConsensusAvailable: false;
  };
}

const STRUCTURAL_FALSE = {
  storage: { persistentPlaintextAllowed: false as const },
  network: {
    externalAssetsAllowed: false as const,
    automaticLinkPreviewsAllowed: false as const,
    telemetryAllowed: false as const,
  },
  notifications: { contentPreviewAllowed: false as const, pushAllowed: false as const },
  ai: { remoteAiAllowed: false as const },
  governance: {
    looseningAllowed: false as const,
    policyVotingAvailable: false as const,
    verifiedGovernanceAvailable: false as const,
    distributedConsensusAvailable: false as const,
  },
};

/** Conservative, mode-aware default policy document for a room. */
export function resolveRoomPolicyDocumentDefaultsV1(input: {
  roomId: RoomLocalId;
  mode: PrivacyMode;
  revision?: RoomPolicyRevision;
}): RoomPolicyDocumentV1 {
  const { mode, roomId } = input;
  const revision = input.revision ?? FIRST_ROOM_POLICY_REVISION;
  const strict = mode === "ghost" || mode === "bunker";
  const offline = mode === "offline_capsule";
  const emergency = mode === "emergency";

  // Retention: strict modes → null; others → memory_only. Never persistent.
  const maximumRetention: RoomPolicyDocumentV1["storage"]["maximumRetention"] = strict
    ? "null"
    : "memory_only";

  // Bunker requires future protected presentation → deny content-bearing views.
  const protectedContentRequirement: ProtectedContentRequirementV1 =
    mode === "bunker" ? "screen_shield_future_required" : "policy_redaction_only";

  return {
    schemaVersion: 1,
    roomId,
    revision,
    sensitivity: mode === "bunker" ? "high_sensitivity" : mode === "ghost" ? "sensitive" : "normal",
    minimumDevicePosture: "unverified", // core cannot satisfy stricter until Secure Device integrates
    protectedContentRequirement: mode === "standard" ? "none" : protectedContentRequirement,
    storage: { maximumRetention, ...STRUCTURAL_FALSE.storage },
    network: {
      networkAllowed: false, // no networking in RoomOS v1 regardless of mode
      directPeerAllowed: false,
      ...STRUCTURAL_FALSE.network,
    },
    metadata: {
      receiptsAllowed: false,
      typingAllowed: false,
      presenceAllowed: false,
      exactCountsAllowed: mode === "standard",
      exactTimestampsAllowed: mode === "standard",
      actorRefsAllowed: mode === "standard" || offline,
    },
    notifications: {
      notificationAllowed: false,
      ...STRUCTURAL_FALSE.notifications,
    },
    ai: { localAiAllowed: false, ...STRUCTURAL_FALSE.ai },
    governance: { ...STRUCTURAL_FALSE.governance },
    // `emergency` deliberately keeps the same conservative shape — Emergency
    // denial is applied in composition, not by loosening the document.
    ...(emergency ? {} : {}),
  };
}
