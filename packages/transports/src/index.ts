/**
 * @freelayer/transports — blind-courier transport interfaces. NO NETWORK CODE.
 *
 * No real transport is implemented in Prompt 03: no fetch, no WebSocket, no
 * WebRTC, no HTTP server, no port binding (network side-effect barrier —
 * docs/NETWORK_MODEL.md, Gate D). Every send/receive requires a
 * PolicyDecision (ADR-0002); transports carry opaque capsule bytes only
 * (ADR-0003).
 */

import { isPolicyDecision, type PolicyDecision, type PolicyCapability } from "@freelayer/privacy";
import { ForbiddenSideEffectError, PolicyBypassError } from "@freelayer/security";

export type TransportKind =
  | "mock"
  | "file"
  | "qr"
  | "bundle"
  | "relay"
  | "lan"
  | "blind_courier"
  | "future_tor_proxy"
  | "future_radio";

/**
 * Per-transport metadata leakage label — surfaces honestly in UX before use
 * (docs/METADATA_MODEL.md, invariants 9–10). Label schema is Gate D design.
 */
export interface TransportMetadataLeakageLabel {
  readonly exposesIp: boolean;
  readonly exposesTiming: boolean;
  readonly exposesSize: boolean;
  readonly exposesCarrierMetadata: boolean;
  readonly requiresUxWarning: boolean;
  readonly notes: string;
}

export interface TransportSendRequest {
  /** Sealed capsule bytes — opaque to the transport, always (ADR-0003). */
  readonly capsuleBytes: Uint8Array;
  /** Opaque routing hint; relay pickup addressing is Phase 4 research. */
  readonly routingHint: Uint8Array;
}

export interface TransportReceiveRequest {
  /** Opaque pickup hint; design blocked by Gate E/Phase 4. */
  readonly pickupHint: Uint8Array;
}

/** All operations require a PolicyDecision issued by core (ADR-0002). */
export interface Transport {
  readonly kind: TransportKind;
  readonly leakageLabel: TransportMetadataLeakageLabel;
  send(request: TransportSendRequest, decision: PolicyDecision): Promise<void>;
  receive(request: TransportReceiveRequest, decision: PolicyDecision): Promise<Uint8Array[]>;
}

function requireDecision(decision: PolicyDecision, capability: PolicyCapability): void {
  if (!isPolicyDecision(decision)) {
    throw new PolicyBypassError(
      "Transport call without a valid PolicyDecision. Side effects must go through core (ADR-0002).",
    );
  }
  if (decision.capability !== capability) {
    throw new PolicyBypassError(
      `Transport call carried a decision for capability "${decision.capability}", expected "${capability}".`,
    );
  }
  if (decision.verdict !== "allowed") {
    throw new ForbiddenSideEffectError("Active policy denies this transport operation.");
  }
}

/**
 * TEST ONLY. In-memory loopback queue. Performs no network I/O of any kind.
 * Exists so pipeline/test code can exercise the Transport contract.
 */
export class MockTransport implements Transport {
  readonly kind: TransportKind = "mock";
  readonly leakageLabel: TransportMetadataLeakageLabel = {
    exposesIp: false,
    exposesTiming: false,
    exposesSize: false,
    exposesCarrierMetadata: false,
    requiresUxWarning: false,
    notes: "TEST ONLY in-memory loopback. Not a real transport.",
  };

  private readonly queue: Uint8Array[] = [];

  // Async so policy-guard failures surface as rejections, not sync throws.
  async send(request: TransportSendRequest, decision: PolicyDecision): Promise<void> {
    requireDecision(decision, "network");
    this.queue.push(request.capsuleBytes);
  }

  async receive(
    _request: TransportReceiveRequest,
    decision: PolicyDecision,
  ): Promise<Uint8Array[]> {
    requireDecision(decision, "network");
    const drained = [...this.queue];
    this.queue.length = 0;
    return drained;
  }
}
