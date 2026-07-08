/**
 * @freelayer/sdk — the only surface apps (and third parties) build against.
 *
 * The SDK calls core. It never exposes storage/transports/crypto/ai and never
 * bypasses policy — third-party code gets the same enforcement as first-party
 * features (docs/ARCHITECTURE.md). Enforced at baseline by
 * scripts/check-boundaries.mjs.
 */

import { createFailClosedPipeline, type CoreOperationPipeline } from "@freelayer/core";

export type { PrivacyMode, PolicyCapability } from "@freelayer/privacy";

export const SDK_VERSION = "0.0.0";

export interface FreeLayerStatus {
  readonly stage: "research_foundation";
  readonly crypto: "not_implemented";
  readonly productFeatures: "none";
  readonly networking: "none";
  readonly localAI: "disabled_not_implemented";
  readonly release: "none";
  readonly warning: string;
}

export interface FreeLayerClient {
  readonly version: string;
  describeStatus(): FreeLayerStatus;
}

/**
 * Placeholder client. Future operations route through the core pipeline held
 * here — which currently fails closed (denies everything) by design.
 */
export function createFreeLayerClient(): FreeLayerClient {
  // Kept to show the wiring: every future SDK operation goes through this
  // pipeline; none may reach a side-effect module directly.
  const pipeline: CoreOperationPipeline = createFailClosedPipeline();
  void pipeline;

  return {
    version: SDK_VERSION,
    describeStatus(): FreeLayerStatus {
      return {
        stage: "research_foundation",
        crypto: "not_implemented",
        productFeatures: "none",
        networking: "none",
        localAI: "disabled_not_implemented",
        release: "none",
        warning: "Do not use with real secrets yet.",
      };
    },
  };
}
