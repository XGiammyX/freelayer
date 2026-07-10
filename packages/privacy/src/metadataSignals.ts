/**
 * Application-signal policy hooks (TECH-10). Foundation only — NO messaging,
 * NO receipts, NO presence, NO notifications are implemented. Each function
 * only asks the Metadata Firewall whether such a signal WOULD be permitted, so
 * the answer is fixed before any feature is built (docs/METADATA_MODEL.md).
 *
 * Every hook delegates to resolveMetadataPolicy — the single source of truth.
 */

import { resolveMetadataPolicy } from "./metadataPolicy";
import type {
  MetadataDeviceRiskLevel,
  MetadataEventKind,
  MetadataPolicy,
  MetadataScreenShieldLevel,
  MetadataSink,
} from "./metadataTypes";
import type { PrivacyMode } from "./index";

interface SignalContext {
  readonly mode: PrivacyMode;
  readonly roomPolicy?: Partial<MetadataPolicy>;
  readonly screenShieldLevel?: MetadataScreenShieldLevel;
  readonly deviceRiskLevel?: MetadataDeviceRiskLevel;
  /** Override the sink; defaults are chosen to reflect how the signal travels. */
  readonly sink?: MetadataSink;
}

/** Forward context, omitting undefined optionals (exactOptionalPropertyTypes). */
function evaluate(
  event: MetadataEventKind,
  sink: MetadataSink,
  ctx: SignalContext,
): MetadataPolicy {
  return resolveMetadataPolicy({
    mode: ctx.mode,
    event,
    sink,
    ...(ctx.roomPolicy !== undefined ? { roomPolicy: ctx.roomPolicy } : {}),
    ...(ctx.screenShieldLevel !== undefined ? { screenShieldLevel: ctx.screenShieldLevel } : {}),
    ...(ctx.deviceRiskLevel !== undefined ? { deviceRiskLevel: ctx.deviceRiskLevel } : {}),
  });
}

export function evaluateReadReceiptPolicy(
  input: SignalContext & { readonly kind?: "read" | "delivery" },
): MetadataPolicy {
  return evaluate(
    input.kind === "delivery" ? "receipt.delivery" : "receipt.read",
    input.sink ?? "transport_envelope",
    input,
  );
}

export function evaluateTypingPolicy(
  input: SignalContext & { readonly phase?: "start" | "stop" },
): MetadataPolicy {
  return evaluate(
    input.phase === "stop" ? "typing.stop" : "typing.start",
    input.sink ?? "transport_envelope",
    input,
  );
}

export function evaluatePresencePolicy(
  input: SignalContext & { readonly state?: "online" | "offline" | "last_seen" },
): MetadataPolicy {
  const event: MetadataEventKind =
    input.state === "offline"
      ? "presence.offline"
      : input.state === "last_seen"
        ? "presence.last_seen"
        : "presence.online";
  return evaluate(event, input.sink ?? "transport_envelope", input);
}

export function evaluateNotificationMetadataPolicy(
  input: SignalContext & { readonly part?: "preview" | "badge" | "sound" },
): MetadataPolicy {
  const event: MetadataEventKind =
    input.part === "badge"
      ? "notification.badge"
      : input.part === "sound"
        ? "notification.sound"
        : "notification.preview";
  return evaluate(event, input.sink ?? "notification_system", input);
}

/** Alias kept for the notification-focused call site in section 18. */
export const evaluateNotificationPolicy = evaluateNotificationMetadataPolicy;

export function evaluateLinkPreviewMetadataPolicy(input: SignalContext): MetadataPolicy {
  return evaluate("link.preview", input.sink ?? "network", input);
}

export function evaluateExternalAssetMetadataPolicy(
  input: SignalContext & { readonly kind?: "asset" | "avatar" },
): MetadataPolicy {
  return evaluate(
    input.kind === "avatar" ? "avatar.remote_fetch" : "asset.remote_fetch",
    input.sink ?? "network",
    input,
  );
}
