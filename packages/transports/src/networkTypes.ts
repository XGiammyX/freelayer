/**
 * NetworkPolicy taxonomy (TECH-08). Types only — no network code.
 *
 * FreeLayer performs NO real network operations. These types model the
 * decision surface so that, when real transports arrive (Gate D / Phase 4),
 * every network side effect is already policy-gated by construction
 * (docs/NETWORK_MODEL.md, ADR-0002/0003).
 */

/** Every network-shaped side effect FreeLayer can be asked to perform. */
export type NetworkOperationKind =
  | "network.connect"
  | "network.request"
  | "network.listen"
  | "transport.send"
  | "transport.receive"
  | "transport.poll"
  | "transport.sync"
  | "transport.discovery"
  | "link.preview"
  | "asset.fetch"
  | "telemetry.send"
  | "update.check"
  | "ai.remote_request";

export const NETWORK_OPERATION_KINDS: readonly NetworkOperationKind[] = [
  "network.connect",
  "network.request",
  "network.listen",
  "transport.send",
  "transport.receive",
  "transport.poll",
  "transport.sync",
  "transport.discovery",
  "link.preview",
  "asset.fetch",
  "telemetry.send",
  "update.check",
  "ai.remote_request",
];

/** How a capsule (or request) is carried. QR/file/USB are OFFLINE, not network. */
export type TransportClass =
  | "relay"
  | "qr"
  | "file"
  | "usb"
  | "lan"
  | "external_app"
  | "email"
  | "websocket"
  | "webrtc"
  | "http"
  | "tor_proxy"
  | "unknown";

/** Offline transports never open a network channel. */
export const OFFLINE_TRANSPORT_CLASSES: readonly TransportClass[] = ["qr", "file", "usb"];

/** Direct-peer transports leak IP/NAT metadata (WebRTC ICE/STUN). */
export const DIRECT_PEER_TRANSPORT_CLASSES: readonly TransportClass[] = ["webrtc"];

export type NetworkCapability =
  | "forbidden"
  | "offline_only"
  | "local_only"
  | "user_initiated_only"
  | "approved_transport_only"
  | "allowed_placeholder";

export type MetadataExposureLevel = "none" | "local_only" | "low" | "medium" | "high" | "unknown";

/** Sensitivity of the metadata an operation would expose. */
export type MetadataSensitivity =
  "none" | "low" | "sensitive_metadata" | "relationship_metadata" | "content_adjacent" | "critical";

export interface NetworkRequest {
  readonly operation: NetworkOperationKind;
  readonly transportClass: TransportClass;
  /** Optional endpoint; validated + redacted, never echoed in errors. */
  readonly endpoint?: string;
  readonly userInitiated: boolean;
  /** Non-sensitive justification for audit. */
  readonly reason: string;
  readonly metadataSensitivity: MetadataSensitivity;
}
