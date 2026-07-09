/**
 * Per-transport metadata leakage labels (TECH-08). Honest, plain-language
 * descriptions of what each transport exposes — surfaced in UX and docs so a
 * transport choice is never a silent metadata decision (docs/METADATA_MODEL.md).
 */

import type { MetadataExposureLevel, NetworkOperationKind, TransportClass } from "./networkTypes";

export interface NetworkMetadataLeakageLabel {
  readonly transportClass: TransportClass;
  readonly exposesIpAddress: boolean;
  readonly exposesTiming: boolean;
  readonly exposesSize: boolean;
  readonly exposesRelationshipMetadata: boolean;
  readonly exposesEndpointToThirdParty: boolean;
  readonly exposureLevel: MetadataExposureLevel;
  readonly plainLanguageSummary: string;
}

const LABELS: Record<TransportClass, Omit<NetworkMetadataLeakageLabel, "transportClass">> = {
  qr: {
    exposesIpAddress: false,
    exposesTiming: false,
    exposesSize: false,
    exposesRelationshipMetadata: false,
    exposesEndpointToThirdParty: false,
    exposureLevel: "local_only",
    plainLanguageSummary:
      "Offline transport. No network. Physical/visual exposure at exchange time.",
  },
  file: {
    exposesIpAddress: false,
    exposesTiming: false,
    exposesSize: true,
    exposesRelationshipMetadata: false,
    exposesEndpointToThirdParty: false,
    exposureLevel: "low",
    plainLanguageSummary:
      "Offline transport. No network. The file channel's own metadata (name, timestamps) may exist.",
  },
  usb: {
    exposesIpAddress: false,
    exposesTiming: false,
    exposesSize: true,
    exposesRelationshipMetadata: false,
    exposesEndpointToThirdParty: false,
    exposureLevel: "low",
    plainLanguageSummary: "Offline transport. No network. Physical courier.",
  },
  lan: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: false,
    exposureLevel: "medium",
    plainLanguageSummary:
      "Local network sees device presence and traffic patterns. Denied by default in strict modes.",
  },
  relay: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "medium",
    plainLanguageSummary:
      "A relay sees your IP, timing and message size unless Tor/proxy is used. It carries ciphertext only.",
  },
  email: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "high",
    plainLanguageSummary:
      "The email provider sees sender, recipient, timing and its own metadata. Content stays sealed; the relationship leaks.",
  },
  external_app: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "high",
    plainLanguageSummary:
      "The courier app sees accounts, timing and its native metadata. Content stays sealed; the relationship leaks.",
  },
  webrtc: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "high",
    plainLanguageSummary:
      "Direct peer connection exposes your real IP (via ICE/STUN) even behind a VPN. Denied in Private, Ghost and Bunker.",
  },
  http: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "high",
    plainLanguageSummary:
      "The server sees your IP, timing and headers. Forbidden until an approved transport exists.",
  },
  websocket: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "high",
    plainLanguageSummary:
      "A persistent bidirectional channel: the server sees your IP, timing and activity. Forbidden.",
  },
  tor_proxy: {
    exposesIpAddress: false,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: false,
    exposesEndpointToThirdParty: false,
    exposureLevel: "medium",
    plainLanguageSummary:
      "Future Tor/proxy layering hides IP from the relay; timing/size correlation remains possible.",
  },
  unknown: {
    exposesIpAddress: true,
    exposesTiming: true,
    exposesSize: true,
    exposesRelationshipMetadata: true,
    exposesEndpointToThirdParty: true,
    exposureLevel: "unknown",
    plainLanguageSummary: "Unknown transport. Exposure cannot be assessed, so it is denied.",
  },
};

export function describeNetworkMetadataLeakage(input: {
  readonly transportClass: TransportClass;
  readonly operation: NetworkOperationKind;
}): NetworkMetadataLeakageLabel {
  const base = LABELS[input.transportClass] ?? LABELS.unknown;
  return { transportClass: input.transportClass, ...base };
}
