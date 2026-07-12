/**
 * Privacy-regression (TECH-14): the Policy Conflict Regression Suite.
 * Table-driven cross-policy comparisons — every row compares REAL resolver
 * output against the Policy Matrix; any disagreement prints an explained
 * PolicyConflict. Also proves composition safety (room/feature tighten-only,
 * Emergency override), gated features are not executable, unknown inputs deny
 * everywhere, and the externalized endpoint-defense stays hook-only.
 */
import { describe, expect, it } from "vitest";
import {
  resolveExternalAssetPolicy,
  resolveLinkPreviewPolicy,
  resolveMetadataPolicy,
  resolveNotificationPolicy,
  resolvePushNotificationPolicy,
  evaluatePolicyMatrix,
  type ExternalAssetKind,
  type MetadataEventKind,
  type MetadataSink,
  type NotificationContentClass,
  type NotificationSurface,
  type PolicyDomain,
  type PrivacyMode,
} from "@freelayer/privacy";
import { resolveStoragePolicy } from "@freelayer/storage";
import { resolveNetworkPolicy } from "@freelayer/transports";
import {
  ALL_MODES,
  assertDeniedEverywhere,
  assertExternalizedHookOnly,
  assertFeaturePolicyCannotLoosenModePolicy,
  assertFutureGatedEverywhere,
  assertNotExecutableEverywhere,
  assertNoPolicyAllowsMetadataWhenMatrixDenies,
  assertNoPolicyAllowsNetworkWhenMatrixDenies,
  assertNoPolicyAllowsPersistenceWhenMatrixDenies,
  assertPoliciesAgree,
  assertRoomPolicyCannotLoosenDevicePolicy,
  explainAll,
} from "../../helpers/policy-conflict-helpers";

describe("Matrix ↔ StoragePolicy (tests 1-4)", () => {
  it("Ghost/Bunker persistent content + preview cache + notification content storage agree", () => {
    const conflicts = [
      ...(["ghost", "bunker"] as const).flatMap((mode) =>
        assertNoPolicyAllowsPersistenceWhenMatrixDenies([
          {
            operation: "storage.write.persistent",
            mode,
            engineName: "StoragePolicy",
            enginePersistent: resolveStoragePolicy({
              mode,
              dataClass: "message_content",
              sensitivity: "content",
            }).persistentAllowed,
          },
        ]),
      ),
      ...(["private", "ghost", "bunker"] as const).flatMap((mode) =>
        assertPoliciesAgree({
          domain: "storage",
          operation: "storage.write.preview_cache",
          mode,
          engineName: "StoragePolicy",
          engineAllowed: resolveStoragePolicy({
            mode,
            dataClass: "preview_cache",
            sensitivity: "metadata",
          }).allowWrite,
        }),
      ),
      // Notification content storage: denied in the matrix; StoragePolicy has
      // no such class by design (born denied) — matrix must say deny.
      ...assertDeniedEverywhere("storage", "storage.write.notification_content"),
    ];
    expect(explainAll(conflicts)).toEqual([]);
  });
});

describe("Matrix ↔ NetworkPolicy (tests 5-9)", () => {
  it("Offline network, telemetry, assets, previews, push all agree", () => {
    const rows: {
      operation: string;
      netOp: "network.request" | "telemetry.send" | "asset.fetch" | "link.preview";
      mode: PrivacyMode;
    }[] = [];
    for (const mode of ALL_MODES) {
      rows.push(
        { operation: "telemetry.send", netOp: "telemetry.send", mode },
        { operation: "asset.fetch", netOp: "asset.fetch", mode },
        { operation: "link.preview", netOp: "link.preview", mode },
      );
    }
    rows.push({ operation: "network.request", netOp: "network.request", mode: "offline_capsule" });
    const conflicts = [
      ...assertNoPolicyAllowsNetworkWhenMatrixDenies(
        rows.map((row) => ({
          operation: row.operation,
          mode: row.mode,
          engineName: "NetworkPolicy",
          engineAllowed: resolveNetworkPolicy({
            mode: row.mode,
            operation: row.netOp,
            transportClass: row.netOp === "network.request" ? "http" : "relay",
          }).allowed,
        })),
      ),
      // Push has no NetworkPolicy operation (never modeled as allowed) — the
      // matrix row itself must be denied everywhere.
      ...assertDeniedEverywhere("network", "notification.push_subscribe"),
    ];
    expect(explainAll(conflicts)).toEqual([]);
  });
});

describe("Matrix ↔ MetadataPolicy (tests 10-13)", () => {
  it("receipts/typing/presence/notification metadata agree across modes", () => {
    const pairs: readonly [string, MetadataEventKind, MetadataSink][] = [
      ["receipt.read", "receipt.read", "transport_envelope"],
      ["typing.start", "typing.start", "transport_envelope"],
      ["presence.online", "presence.online", "transport_envelope"],
      ["notification.preview", "notification.preview", "notification_system"],
    ];
    const conflicts = ALL_MODES.flatMap((mode) =>
      pairs.flatMap(([operation, event, sink]) =>
        assertNoPolicyAllowsMetadataWhenMatrixDenies([
          {
            operation,
            mode,
            engineName: "MetadataPolicy",
            engineAllowed: resolveMetadataPolicy({ mode, event, sink }).allowed,
          },
        ]),
      ),
    );
    expect(explainAll(conflicts)).toEqual([]);
  });
});

describe("Matrix ↔ LinkPreview/ExternalAsset (tests 14-17)", () => {
  it("automatic preview + OpenGraph/favicon + remote assets agree", () => {
    const conflicts = [
      ...ALL_MODES.flatMap((mode) => [
        ...assertPoliciesAgree({
          domain: "link_preview",
          operation: "preview.automatic",
          mode,
          engineName: "LinkPreviewPolicy",
          engineAllowed: resolveLinkPreviewPolicy({ mode }).automaticPreviewAllowed,
        }),
        ...assertPoliciesAgree({
          domain: "link_preview",
          operation: "preview.opengraph_fetch",
          mode,
          engineName: "LinkPreviewPolicy",
          engineAllowed: resolveLinkPreviewPolicy({ mode }).openGraphAllowed,
        }),
        ...assertPoliciesAgree({
          domain: "link_preview",
          operation: "preview.favicon_fetch",
          mode,
          engineName: "LinkPreviewPolicy",
          engineAllowed: resolveLinkPreviewPolicy({ mode }).faviconAllowed,
        }),
      ]),
      ...ALL_MODES.flatMap((mode) =>
        (["remote_image", "remote_font", "remote_script"] as const).flatMap(
          (kind: ExternalAssetKind) =>
            assertPoliciesAgree({
              domain: "external_asset",
              operation: `asset.${kind}`,
              mode,
              engineName: "ExternalAssetPolicy",
              engineAllowed: resolveExternalAssetPolicy({ mode, assetKind: kind }).allowed,
            }),
        ),
      ),
    ];
    expect(explainAll(conflicts)).toEqual([]);
  });
});

describe("Matrix ↔ NotificationPolicy (tests 18-20)", () => {
  it("message preview, Bunker badge, push/service-worker agree", () => {
    const previewRows = ALL_MODES.flatMap((mode) =>
      assertPoliciesAgree({
        domain: "notification",
        operation: "notification.show.message_preview",
        mode,
        engineName: "NotificationPolicy",
        engineAllowed: resolveNotificationPolicy({
          mode,
          operation: "notification.show",
          contentClass: "message_preview" as NotificationContentClass,
          surface: "system_banner" as NotificationSurface,
        }).allowed,
      }),
    );
    const badgeRows = assertPoliciesAgree({
      domain: "notification",
      operation: "notification.badge.count",
      mode: "bunker",
      engineName: "NotificationPolicy",
      engineAllowed: resolveNotificationPolicy({
        mode: "bunker",
        operation: "notification.badge",
        contentClass: "activity_count",
        surface: "app_badge",
      }).allowed,
    });
    const pushRows = ALL_MODES.flatMap((mode) => [
      ...assertPoliciesAgree({
        domain: "notification",
        operation: "notification.push_subscribe",
        mode,
        engineName: "NotificationPolicy",
        engineAllowed: resolvePushNotificationPolicy({ mode, contentClass: "generic" }).allowed,
      }),
      ...assertPoliciesAgree({
        domain: "notification",
        operation: "notification.service_worker_show",
        mode,
        engineName: "NotificationPolicy",
        engineAllowed: resolveNotificationPolicy({
          mode,
          operation: "notification.service_worker_show",
          contentClass: "generic",
          surface: "service_worker",
        }).allowed,
      }),
    ]);
    expect(explainAll([...previewRows, ...badgeRows, ...pushRows])).toEqual([]);
  });
});

describe("AI + externalized endpoint-defense (tests 21-24)", () => {
  it("remote AI denied everywhere; Ghost/Bunker AI denied (matrix + metadata agree)", () => {
    const conflicts = [
      ...assertDeniedEverywhere("ai", "ai.remote_request"),
      ...(["ghost", "bunker"] as const).flatMap((mode) => {
        const matrix = evaluatePolicyMatrix({ mode, domain: "ai", operation: "ai.local_request" });
        const meta = resolveMetadataPolicy({ mode, event: "ai.prompt_exists", sink: "ai" });
        return matrix.allowed || meta.allowed
          ? [
              {
                category: "allow_vs_deny" as const,
                domain: "ai" as PolicyDomain,
                mode,
                operation: "ai.local_request",
                expected: "deny",
                actual: matrix.allowed ? "matrix:allow" : "MetadataPolicy:allow",
                severity: "critical" as const,
                explanation: "AI must be denied in Ghost/Bunker.",
              },
            ]
          : [];
      }),
    ];
    expect(explainAll(conflicts)).toEqual([]);
  });

  it("endpoint-defense capabilities are externalized hook-only + integration future-gated (tests 23-24)", () => {
    const conflicts = assertExternalizedHookOnly([
      { domain: "endpoint", operation: "clipboard.copy_protected" },
      { domain: "endpoint", operation: "input.secure_field" },
      { domain: "endpoint", operation: "display.task_switcher_preview" },
      { domain: "endpoint", operation: "display.screenshot_blocking" },
      { domain: "endpoint", operation: "desktop.tauri_permissions" },
    ]);
    expect(explainAll(conflicts)).toEqual([]);
    // Integration is future-gated, not merely denied-by-accident.
    for (const op of ["display.screenshot_blocking", "desktop.tauri_permissions"]) {
      expect(explainAll(assertFutureGatedEverywhere("endpoint", op)), op).toEqual([]);
    }
  });
});

describe("Composition safety (tests 25-30)", () => {
  it("room/feature policy cannot loosen; Emergency overrides; Offline denies polling", () => {
    const conflicts = [
      // Room loosening attempts across denied rows in strict modes.
      ...(["ghost", "bunker"] as const).flatMap((mode) => [
        ...assertRoomPolicyCannotLoosenDevicePolicy({
          domain: "storage",
          operation: "storage.write.persistent",
          mode,
        }),
        ...assertRoomPolicyCannotLoosenDevicePolicy({
          domain: "notification",
          operation: "notification.show.message_preview",
          mode,
        }),
        ...assertRoomPolicyCannotLoosenDevicePolicy({
          domain: "metadata",
          operation: "receipt.read",
          mode,
        }),
      ]),
      ...assertFeaturePolicyCannotLoosenModePolicy({
        domain: "metadata",
        operation: "protected_content.revealed",
        mode: "ghost",
      }),
    ];
    expect(explainAll(conflicts)).toEqual([]);

    // Emergency overrides a normally-allowed operation (test 29).
    expect(
      evaluatePolicyMatrix({
        mode: "private",
        domain: "storage",
        operation: "storage.write.memory",
      }).allowed,
    ).toBe(true);
    expect(
      evaluatePolicyMatrix({
        mode: "emergency",
        domain: "storage",
        operation: "storage.write.memory",
      }).allowed,
    ).toBe(false);

    // Offline Capsule cannot permit relay polling (test 30) — matrix + engine.
    expect(
      evaluatePolicyMatrix({
        mode: "offline_capsule",
        domain: "network",
        operation: "transport.send",
      }).allowed,
    ).toBe(false);
    expect(
      resolveNetworkPolicy({
        mode: "offline_capsule",
        operation: "transport.poll",
        transportClass: "relay",
      }).allowed,
    ).toBe(false);
  });
});

describe("Gated features are not executable (tests 31-35, 42-44)", () => {
  it("crypto / encrypted storage / capsule / room sync / identity", () => {
    const conflicts = [
      ...assertFutureGatedEverywhere("crypto", "crypto.any"),
      ...assertFutureGatedEverywhere("storage", "storage.backend.encrypted_persistent"),
      ...assertFutureGatedEverywhere("capsule", "capsule.wire_format"),
      ...assertFutureGatedEverywhere("room", "room.sync"),
      ...assertFutureGatedEverywhere("identity", "identity.invite"),
      // not_implemented + require_user_action are not executable either.
      ...assertNotExecutableEverywhere("notification", "notification.badge.count"),
      ...assertNotExecutableEverywhere("notification", "notification.permission_request"),
    ];
    expect(explainAll(conflicts)).toEqual([]);
  });
});

describe("Unknown inputs deny everywhere (tests 36-41)", () => {
  it("unknown operation/sink/transport/content/asset deny across matrix and engines", () => {
    // Matrix: unknown operation.
    expect(
      evaluatePolicyMatrix({ mode: "standard", domain: "storage", operation: "storage.teleport" })
        .allowed,
    ).toBe(false);
    // Engines: unknown enums fail closed.
    expect(
      resolveMetadataPolicy({
        mode: "standard",
        event: "unknown",
        sink: "carrier_pigeon" as MetadataSink,
      }).allowed,
    ).toBe(false);
    expect(
      resolveNetworkPolicy({
        mode: "standard",
        operation: "transport.send",
        transportClass: "carrier_pigeon" as never,
      }).allowed,
    ).toBe(false);
    expect(
      resolveNotificationPolicy({
        mode: "standard",
        operation: "notification.unknown",
        contentClass: "unknown",
        surface: "unknown",
      }).allowed,
    ).toBe(false);
    expect(resolveExternalAssetPolicy({ mode: "standard", assetKind: "unknown" }).allowed).toBe(
      false,
    );
    // Deny overrides allow in composed decisions (test 41) is covered by the
    // composition tests in policy-matrix.test.ts; assert the invariant here too.
    expect(
      evaluatePolicyMatrix({
        mode: "standard",
        domain: "metadata",
        operation: "audit_event.write",
        roomPolicy: { allowed: false },
      }).allowed,
    ).toBe(false);
  });
});
