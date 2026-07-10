/**
 * LinkPreviewPolicy v0 (TECH-11). Automatic link previews are a privacy trap:
 * one auto-fetch leaks the URL, IP, user-agent, referrer, DNS, and open-timing.
 * So FreeLayer denies ALL automatic previews and ALL preview network fetches in
 * every mode. The most any mode permits is showing the URL as redacted plain
 * text; a real (user-initiated, policy-gated) preview is a FUTURE gate
 * (docs/research/LINK_PREVIEW_EXTERNAL_ASSET_BLOCKING_RESEARCH.md).
 *
 * No fetching, no OpenGraph parsing, no caching — this only decides.
 */

import type { PrivacyMode } from "./index";

export type LinkPreviewAction =
  "deny" | "show_plain_text_only" | "require_user_action_future" | "redact" | "not_implemented";

export interface LinkPreviewPolicy {
  readonly mode: PrivacyMode;
  readonly action: LinkPreviewAction;
  readonly automaticPreviewAllowed: boolean;
  readonly networkFetchAllowed: boolean;
  readonly cacheAllowed: boolean;
  readonly thumbnailAllowed: boolean;
  readonly faviconAllowed: boolean;
  readonly openGraphAllowed: boolean;
  readonly userActionRequired: boolean;
  readonly reason: string;
}

export interface LinkPreviewPolicyInput {
  readonly mode: PrivacyMode;
  readonly urlKind?: "unknown" | "plain_text_url" | "markdown_link" | "detected_url";
  readonly roomPolicy?: Partial<LinkPreviewPolicy>;
  readonly screenShieldLevel?: "off" | "standard" | "protected" | "sealed" | "bunker";
  readonly deviceRiskLevel?: "low" | "medium" | "high" | "critical" | "unknown";
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

export function resolveLinkPreviewPolicy(input: LinkPreviewPolicyInput): LinkPreviewPolicy {
  const { mode } = input;
  const shield = input.screenShieldLevel ?? "off";
  const sealed = shield === "sealed" || shield === "bunker";

  // Everything preview-fetch-shaped is denied, in every mode. These never flip.
  const base = {
    mode,
    automaticPreviewAllowed: false,
    networkFetchAllowed: false,
    cacheAllowed: false,
    thumbnailAllowed: false,
    faviconAllowed: false,
    openGraphAllowed: false,
    userActionRequired: true, // a real preview would require explicit user action (future gate)
  } as const;

  // Fail closed on unknown mode.
  if (!KNOWN_MODES.includes(mode)) {
    return {
      ...base,
      action: "deny",
      reason: "unknown mode: fail closed",
    };
  }

  // Sealed/bunker ScreenShield collapses the URL to a redacted label.
  let action: LinkPreviewAction = sealed ? "redact" : "show_plain_text_only";
  let reason = sealed
    ? `${mode}/shield: URL shown as a fully redacted label; no preview, no fetch`
    : `${mode}: URL shown as redacted plain text only; automatic preview and all preview fetches denied`;

  // Room policy composition: TIGHTEN ONLY. A room may force deny/redact; it can
  // never enable a preview or a fetch.
  const room = input.roomPolicy;
  if (room !== undefined) {
    if (room.action === "deny" || room.action === "redact" || room.action === "not_implemented") {
      action = room.action;
    }
    // A room asking to *allow* anything is ignored (all allow-flags stay false).
    reason = `${reason}; room policy composed (tighten-only)`;
  }

  return { ...base, action, reason };
}
