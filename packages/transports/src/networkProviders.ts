/**
 * Mock/Noop network transports (TECH-08). NO REAL NETWORK.
 *
 * No fetch, WebSocket, WebRTC, EventSource, sendBeacon, or Tauri HTTP. Every
 * operation goes through the network barrier (decision + policy). NoopTransport
 * validates and does nothing; MockTransport records sends in memory for tests.
 */

import type { PolicyDecision } from "@freelayer/privacy";
import { assertNetworkOperationAllowed } from "./networkBarrier";
import type { NetworkPolicy } from "./networkPolicy";
import type { NetworkRequest, TransportClass } from "./networkTypes";

export interface NetworkTransport {
  readonly kind: TransportClass | "noop" | "mock";
  readonly performsRealNetwork: false;
  send(request: NetworkRequest, decision: PolicyDecision, policy: NetworkPolicy): Promise<void>;
  receive(
    request: NetworkRequest,
    decision: PolicyDecision,
    policy: NetworkPolicy,
  ): Promise<readonly Uint8Array[]>;
}

/** Validates and does nothing. The safe default for "network exists but is off". */
export class NoopTransport implements NetworkTransport {
  readonly kind = "noop" as const;
  readonly performsRealNetwork = false as const;

  async send(
    request: NetworkRequest,
    decision: PolicyDecision,
    policy: NetworkPolicy,
  ): Promise<void> {
    assertNetworkOperationAllowed(request, decision, policy);
    // Deliberately nothing.
  }

  async receive(
    request: NetworkRequest,
    decision: PolicyDecision,
    policy: NetworkPolicy,
  ): Promise<readonly Uint8Array[]> {
    assertNetworkOperationAllowed(request, decision, policy);
    return [];
  }
}

/**
 * TEST-ONLY in-memory transport. Records sent capsule bytes in a local queue
 * so pipeline/tests can exercise the contract. Performs NO network I/O.
 * (Named MockNetworkTransport to avoid colliding with the Prompt-03
 * capsule-level `MockTransport` re-exported from index.ts.)
 */
export class MockNetworkTransport implements NetworkTransport {
  readonly kind = "mock" as const;
  readonly performsRealNetwork = false as const;
  private readonly queue: Uint8Array[] = [];

  async send(
    request: NetworkRequest,
    decision: PolicyDecision,
    policy: NetworkPolicy,
  ): Promise<void> {
    assertNetworkOperationAllowed(request, decision, policy);
    this.queue.push(new Uint8Array(0)); // no real payload; contract exercise only
  }

  async receive(
    request: NetworkRequest,
    decision: PolicyDecision,
    policy: NetworkPolicy,
  ): Promise<readonly Uint8Array[]> {
    assertNetworkOperationAllowed(request, decision, policy);
    const drained = [...this.queue];
    this.queue.length = 0;
    return drained;
  }
}

export const createNoopTransport = (): NoopTransport => new NoopTransport();
export const createMockNetworkTransport = (): MockNetworkTransport => new MockNetworkTransport();
