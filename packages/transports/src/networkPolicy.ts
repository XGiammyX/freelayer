/**
 * NetworkPolicy v0 — the mode × operation × transport matrix (TECH-08).
 *
 * Resolution principles, in order:
 *   1. DEFAULT DENY — anything not explicitly allowed is denied.
 *   2. STRICTEST WINS — room policy can only tighten the device baseline.
 *   3. NO REAL NETWORK — nothing is implemented; the most any operation
 *      reaches is `allowed_placeholder` (future user-initiated approved
 *      transport), which still performs no I/O.
 *
 * Explicit and boring: predicates over operation/transport/mode, no rule
 * engine (docs/NETWORK_MODEL.md).
 */

import type { PrivacyMode } from "@freelayer/privacy";
import {
  DIRECT_PEER_TRANSPORT_CLASSES,
  NETWORK_OPERATION_KINDS,
  OFFLINE_TRANSPORT_CLASSES,
  type MetadataExposureLevel,
  type NetworkCapability,
  type NetworkOperationKind,
  type TransportClass,
} from "./networkTypes";
import { describeNetworkMetadataLeakage } from "./networkMetadata";

export type DeviceRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type ScreenShieldLevel = "off" | "standard" | "protected" | "sealed" | "bunker";

export interface NetworkPolicy {
  readonly mode: PrivacyMode;
  readonly operation: NetworkOperationKind;
  readonly transportClass: TransportClass;
  readonly capability: NetworkCapability;
  readonly allowed: boolean;
  readonly requiresUserInitiation: boolean;
  readonly allowsDirectPeerConnection: boolean;
  readonly allowsExternalEndpoint: boolean;
  readonly allowsTelemetry: boolean;
  readonly allowsExternalAssets: boolean;
  readonly allowsAutomaticLinkPreview: boolean;
  readonly metadataExposure: MetadataExposureLevel;
  readonly reason: string;
}

export interface NetworkPolicyInput {
  readonly mode: PrivacyMode;
  readonly operation: NetworkOperationKind;
  readonly transportClass: TransportClass;
  readonly userInitiated?: boolean;
  readonly endpoint?: string;
  readonly roomPolicy?: Partial<NetworkPolicy>;
  readonly deviceRiskLevel?: DeviceRiskLevel;
  readonly screenShieldLevel?: ScreenShieldLevel;
}

const KNOWN_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

const KNOWN_TRANSPORTS: readonly TransportClass[] = [
  "relay",
  "qr",
  "file",
  "usb",
  "lan",
  "external_app",
  "email",
  "websocket",
  "webrtc",
  "http",
  "tor_proxy",
  "unknown",
];

/** Operations that are always forbidden, in every mode (ADR-0008). */
const ALWAYS_FORBIDDEN_OPERATIONS: readonly NetworkOperationKind[] = [
  "telemetry.send",
  "asset.fetch",
  "link.preview",
  "ai.remote_request",
  "update.check", // manual/future only; not implemented, so denied now
];

/** Modes that deny all network operations. */
const OFFLINE_MODES: readonly PrivacyMode[] = ["offline_capsule", "emergency"];

/** Modes that deny direct peer connections and strictly minimize network. */
const STRICT_MODES: readonly PrivacyMode[] = ["ghost", "bunker"];

interface Draft {
  capability: NetworkCapability;
  allowed: boolean;
  requiresUserInitiation: boolean;
  allowsDirectPeerConnection: boolean;
  allowsExternalEndpoint: boolean;
  reasons: string[];
}

function denied(reason: string): Draft {
  return {
    capability: "forbidden",
    allowed: false,
    requiresUserInitiation: false,
    allowsDirectPeerConnection: false,
    allowsExternalEndpoint: false,
    reasons: [reason],
  };
}

export function resolveNetworkPolicy(input: NetworkPolicyInput): NetworkPolicy {
  const { mode, operation, transportClass } = input;
  const label = describeNetworkMetadataLeakage({ transportClass, operation });

  const finalize = (draft: Draft): NetworkPolicy => {
    // Room policy composition: TIGHTEN ONLY.
    const room = input.roomPolicy;
    let allowed = draft.allowed;
    let directPeer = draft.allowsDirectPeerConnection;
    let externalEndpoint = draft.allowsExternalEndpoint;
    const reasons = [...draft.reasons];
    if (room !== undefined) {
      allowed = allowed && (room.allowed ?? true);
      directPeer = directPeer && (room.allowsDirectPeerConnection ?? true);
      externalEndpoint = externalEndpoint && (room.allowsExternalEndpoint ?? true);
      reasons.push("room policy composed (tighten-only)");
    }
    return {
      mode,
      operation,
      transportClass,
      capability: allowed ? draft.capability : "forbidden",
      allowed,
      requiresUserInitiation: draft.requiresUserInitiation,
      allowsDirectPeerConnection: directPeer,
      allowsExternalEndpoint: externalEndpoint,
      allowsTelemetry: false, // never, in any mode
      allowsExternalAssets: false, // never (ADR-0008)
      allowsAutomaticLinkPreview: false, // never
      metadataExposure: label.exposureLevel,
      reason: reasons.join("; "),
    };
  };

  // ---- FAIL CLOSED: unknown operation, transport, or mode ----
  if (
    !NETWORK_OPERATION_KINDS.includes(operation) ||
    !KNOWN_TRANSPORTS.includes(transportClass) ||
    !KNOWN_MODES.includes(mode)
  ) {
    return finalize(denied("unknown operation/transport/mode: fail closed"));
  }

  // ---- Always-forbidden operations (telemetry, assets, previews, remote AI, update) ----
  if (ALWAYS_FORBIDDEN_OPERATIONS.includes(operation)) {
    return finalize(denied(`operation "${operation}" is forbidden by default`));
  }

  // ---- Offline transports (QR/file/USB) are never network operations ----
  if (OFFLINE_TRANSPORT_CLASSES.includes(transportClass)) {
    // They still require a decision at the transport layer, but they are not
    // egress. Modeled as local-only capability, allowed as a placeholder.
    return finalize({
      capability: "offline_only",
      allowed: !OFFLINE_MODES.includes(mode) || mode === "offline_capsule",
      requiresUserInitiation: false,
      allowsDirectPeerConnection: false,
      allowsExternalEndpoint: false,
      reasons: [`offline transport "${transportClass}" is not a network operation`],
    });
  }

  // ---- Offline Capsule + Emergency: deny all (networked) operations ----
  if (OFFLINE_MODES.includes(mode)) {
    return finalize(denied(`mode "${mode}" denies all network operations`));
  }

  // ---- Direct peer connections (WebRTC): denied in Private/Ghost/Bunker ----
  if (DIRECT_PEER_TRANSPORT_CLASSES.includes(transportClass)) {
    if (mode === "standard") {
      // Even Standard denies WebRTC unless a future explicit policy allows it.
      return finalize(
        denied("direct peer connection (WebRTC) denied pending explicit future policy"),
      );
    }
    return finalize(denied(`direct peer connection denied in mode "${mode}" (IP exposure)`));
  }

  // ---- Strict modes (Ghost/Bunker): deny direct network ----
  if (STRICT_MODES.includes(mode)) {
    return finalize(
      denied(
        `mode "${mode}" denies direct network operations; only future approved couriers, if modeled`,
      ),
    );
  }

  // ---- LAN discovery: denied by default in every non-offline mode for now ----
  if (transportClass === "lan" || operation === "transport.discovery") {
    return finalize(denied("LAN discovery denied by default (presence metadata)"));
  }

  // ---- HTTP/WebSocket direct: forbidden until an approved transport exists ----
  if (transportClass === "http" || transportClass === "websocket") {
    return finalize(
      denied(`transport "${transportClass}" forbidden until an approved transport exists`),
    );
  }

  // ---- Standard/Private + relay/email/external_app/tor: user-initiated
  //      approved-transport PLACEHOLDER only. Nothing is implemented, so this
  //      is the ceiling — it never performs I/O. ----
  if (mode === "standard" || mode === "private") {
    return finalize({
      capability: "allowed_placeholder",
      allowed: true,
      requiresUserInitiation: true,
      allowsDirectPeerConnection: false,
      allowsExternalEndpoint: transportClass === "relay" || transportClass === "email",
      reasons: [
        `mode "${mode}": ${transportClass} is a user-initiated approved-transport placeholder (no network implemented)`,
      ],
    });
  }

  // ---- Sovereign Room baseline == private-ish; composition already applied. ----
  if (mode === "sovereign_room") {
    return finalize({
      capability: "approved_transport_only",
      allowed: true,
      requiresUserInitiation: true,
      allowsDirectPeerConnection: false,
      allowsExternalEndpoint: transportClass === "relay",
      reasons: [
        "sovereign_room: approved-transport placeholder; room policy composes tighten-only",
      ],
    });
  }

  return finalize(denied("no rule matched: default deny"));
}
