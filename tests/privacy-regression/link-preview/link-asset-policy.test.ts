/**
 * Privacy-regression (TECH-11): automatic link previews and every external
 * asset are denied in all modes, and LinkPreviewPolicy / ExternalAssetPolicy
 * agree with MetadataPolicy, NetworkPolicy, and StoragePolicy.
 */
import { describe, expect, it } from "vitest";
import {
  resolveExternalAssetPolicy,
  resolveLinkPreviewPolicy,
  resolveMetadataPolicy,
  type ExternalAssetKind,
  type PrivacyMode,
} from "@freelayer/privacy";
import { resolveNetworkPolicy } from "@freelayer/transports";
import { resolveStoragePolicy } from "@freelayer/storage";

const ALL_MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

describe("Automatic link previews denied in all modes", () => {
  it("no automatic preview, no fetch, no favicon/OpenGraph/thumbnail/cache (tests 1-11)", () => {
    for (const mode of ALL_MODES) {
      const p = resolveLinkPreviewPolicy({ mode });
      expect(p.automaticPreviewAllowed, mode).toBe(false);
      expect(p.networkFetchAllowed, mode).toBe(false);
      expect(p.openGraphAllowed, mode).toBe(false);
      expect(p.faviconAllowed, mode).toBe(false);
      expect(p.thumbnailAllowed, mode).toBe(false);
      expect(p.cacheAllowed, mode).toBe(false);
      expect(p.userActionRequired, mode).toBe(true);
    }
  });

  it("relaxed modes show plain text; sealed ScreenShield redacts (test 24)", () => {
    expect(resolveLinkPreviewPolicy({ mode: "standard" }).action).toBe("show_plain_text_only");
    expect(resolveLinkPreviewPolicy({ mode: "standard", screenShieldLevel: "sealed" }).action).toBe(
      "redact",
    );
    expect(resolveLinkPreviewPolicy({ mode: "private", screenShieldLevel: "bunker" }).action).toBe(
      "redact",
    );
  });

  it("room policy cannot loosen preview denial (test 25)", () => {
    const p = resolveLinkPreviewPolicy({
      mode: "private",
      roomPolicy: {
        action: "show_plain_text_only",
        automaticPreviewAllowed: true,
        networkFetchAllowed: true,
      },
    });
    expect(p.automaticPreviewAllowed).toBe(false);
    expect(p.networkFetchAllowed).toBe(false);
  });

  it("unknown mode fails closed to deny", () => {
    expect(resolveLinkPreviewPolicy({ mode: "party" as PrivacyMode }).action).toBe("deny");
  });
});

describe("External assets denied in all modes (tests 12-20)", () => {
  const KINDS: readonly ExternalAssetKind[] = [
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

  it("every asset kind is denied, un-fetchable, un-cacheable, un-renderable", () => {
    for (const mode of ALL_MODES) {
      for (const assetKind of KINDS) {
        const p = resolveExternalAssetPolicy({ mode, assetKind });
        expect(p.allowed, `${mode}/${assetKind}`).toBe(false);
        expect(p.networkFetchAllowed, `${mode}/${assetKind}`).toBe(false);
        expect(p.cacheAllowed, `${mode}/${assetKind}`).toBe(false);
        expect(p.renderAllowed, `${mode}/${assetKind}`).toBe(false);
      }
    }
  });

  it("tracking pixels and connection hints require a user-visible warning if surfaced", () => {
    for (const assetKind of [
      "tracking_pixel",
      "preconnect",
      "dns_prefetch",
      "preload",
      "prefetch",
    ] as const) {
      expect(
        resolveExternalAssetPolicy({ mode: "standard", assetKind }).userVisibleWarningRequired,
      ).toBe(true);
    }
  });

  it("room policy cannot loosen external asset denial", () => {
    const p = resolveExternalAssetPolicy({
      mode: "standard",
      assetKind: "remote_avatar",
      roomPolicy: { allowed: true, renderAllowed: true },
    });
    expect(p.allowed).toBe(false);
    expect(p.renderAllowed).toBe(false);
  });
});

describe("Cross-policy agreement", () => {
  it("MetadataPolicy and LinkPreviewPolicy agree (test 21)", () => {
    for (const mode of ALL_MODES) {
      const link = resolveLinkPreviewPolicy({ mode });
      const meta = resolveMetadataPolicy({ mode, event: "link.preview", sink: "network" });
      expect(link.automaticPreviewAllowed, mode).toBe(false);
      expect(meta.allowed, mode).toBe(false);
    }
  });

  it("NetworkPolicy and LinkPreviewPolicy agree (test 22)", () => {
    for (const mode of ["standard", "private", "ghost", "bunker"] as const) {
      const link = resolveLinkPreviewPolicy({ mode });
      const net = resolveNetworkPolicy({
        mode,
        operation: "link.preview",
        transportClass: "relay",
      });
      const asset = resolveNetworkPolicy({
        mode,
        operation: "asset.fetch",
        transportClass: "relay",
      });
      expect(link.networkFetchAllowed, mode).toBe(false);
      expect(net.allowed, mode).toBe(false);
      expect(asset.allowed, mode).toBe(false);
    }
  });

  it("StoragePolicy and LinkPreviewPolicy agree on preview cache denial (test 23)", () => {
    for (const mode of ["private", "ghost", "bunker"] as const) {
      const link = resolveLinkPreviewPolicy({ mode });
      const store = resolveStoragePolicy({
        mode,
        dataClass: "preview_cache",
        sensitivity: "metadata",
      });
      const thumb = resolveStoragePolicy({
        mode,
        dataClass: "thumbnail_cache",
        sensitivity: "metadata",
      });
      expect(link.cacheAllowed, mode).toBe(false);
      expect(link.thumbnailAllowed, mode).toBe(false);
      expect(store.allowWrite, mode).toBe(false);
      expect(thumb.allowWrite, mode).toBe(false);
    }
  });

  it("MetadataPolicy and ExternalAssetPolicy agree on remote asset denial", () => {
    const meta = resolveMetadataPolicy({
      mode: "standard",
      event: "asset.remote_fetch",
      sink: "network",
    });
    const avatarMeta = resolveMetadataPolicy({
      mode: "standard",
      event: "avatar.remote_fetch",
      sink: "network",
    });
    expect(meta.allowed).toBe(false);
    expect(avatarMeta.allowed).toBe(false);
    expect(
      resolveExternalAssetPolicy({ mode: "standard", assetKind: "remote_image" }).allowed,
    ).toBe(false);
    expect(
      resolveExternalAssetPolicy({ mode: "standard", assetKind: "remote_avatar" }).allowed,
    ).toBe(false);
  });
});
