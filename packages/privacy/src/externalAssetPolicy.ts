/**
 * ExternalAssetPolicy v0 (TECH-11). Every external asset — remote image, font,
 * script, stylesheet, avatar, favicon, OpenGraph image, tracking pixel, iframe,
 * and the connection hints preconnect/dns-prefetch/preload/prefetch — is a
 * network side effect and a metadata leak. All are DENIED in every mode. Avatars
 * and images must instead travel as future capsule content, never remote URLs
 * (docs/NETWORK_MODEL.md, ADR-0008). No fetching — this only decides.
 */

import type { PrivacyMode } from "./index";

export type ExternalAssetKind =
  | "remote_image"
  | "remote_avatar"
  | "remote_font"
  | "remote_script"
  | "remote_stylesheet"
  | "remote_css_url"
  | "tracking_pixel"
  | "favicon"
  | "opengraph_image"
  | "video"
  | "audio"
  | "iframe"
  | "preconnect"
  | "dns_prefetch"
  | "preload"
  | "prefetch"
  | "unknown";

export const EXTERNAL_ASSET_KINDS: readonly ExternalAssetKind[] = [
  "remote_image",
  "remote_avatar",
  "remote_font",
  "remote_script",
  "remote_stylesheet",
  "remote_css_url",
  "tracking_pixel",
  "favicon",
  "opengraph_image",
  "video",
  "audio",
  "iframe",
  "preconnect",
  "dns_prefetch",
  "preload",
  "prefetch",
  "unknown",
];

export interface ExternalAssetPolicy {
  readonly mode: PrivacyMode;
  readonly assetKind: ExternalAssetKind;
  readonly allowed: boolean;
  readonly networkFetchAllowed: boolean;
  readonly cacheAllowed: boolean;
  readonly renderAllowed: boolean;
  readonly userVisibleWarningRequired: boolean;
  readonly reason: string;
}

export interface ExternalAssetPolicyInput {
  readonly mode: PrivacyMode;
  readonly assetKind: ExternalAssetKind;
  readonly source?: string;
  readonly roomPolicy?: Partial<ExternalAssetPolicy>;
  readonly screenShieldLevel?: "off" | "standard" | "protected" | "sealed" | "bunker";
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

/** Kinds that are pure activity beacons — worth a user-visible warning if surfaced. */
const BEACON_KINDS: readonly ExternalAssetKind[] = [
  "tracking_pixel",
  "preconnect",
  "dns_prefetch",
  "preload",
  "prefetch",
];

export function resolveExternalAssetPolicy(input: ExternalAssetPolicyInput): ExternalAssetPolicy {
  const { mode, assetKind } = input;

  const known = KNOWN_MODES.includes(mode) && EXTERNAL_ASSET_KINDS.includes(assetKind);
  const reason = !known
    ? "unknown mode/asset kind: fail closed"
    : assetKind === "unknown"
      ? "unknown asset kind denied"
      : `external asset "${assetKind}" is forbidden in every mode (ADR-0008; travels as capsule content, never a remote URL)`;

  // Every external asset is denied, unconditionally. Room policy can only keep
  // it denied (there is nothing to loosen), so composition is a no-op here.
  return {
    mode,
    assetKind,
    allowed: false,
    networkFetchAllowed: false,
    cacheAllowed: false,
    renderAllowed: false,
    userVisibleWarningRequired: BEACON_KINDS.includes(assetKind),
    reason,
  };
}
