/**
 * Security-regression (TECH-23): Secure Device contract leak traps, side-effect
 * traps, matrix/storage/metadata agreement, PBOM/Trust Center honesty, the
 * core-boundary guardrail, and the continued ABSENCE of GrapheneOS management /
 * MDM / attestation / anti-spyware in core. Covers §23 (29-33) + sentinel.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createSensitiveRoomSessionV1,
  resolveSensitiveRoomAdmissionV1,
  SecureDeviceError,
  SensitiveRoomAdmissionDeniedError,
  SensitiveRoomSessionStaleError,
  DevicePostureAssessmentInvalidError,
  assertSensitiveRoomSessionCurrentV1,
} from "@freelayer/rooms";
import { evaluatePolicyMatrix, resolveMetadataPolicy } from "@freelayer/privacy";
import { resolveStoragePolicy } from "@freelayer/storage";
import {
  forgedAssessment,
  membership,
  NULL_CAPS,
  NULL_STATUS,
  requiring,
  roomPolicy,
  SECURE_DEVICE_SENTINEL,
  unverifiedAssessment,
} from "../../../fixtures/secure-device-contract/v1/synthetic";

const SECURE_DEVICE_DIR = join("packages", "rooms", "src", "secure-device");

function admit(over?: Partial<Parameters<typeof resolveSensitiveRoomAdmissionV1>[0]>) {
  return resolveSensitiveRoomAdmissionV1({
    action: "room.content.read",
    roomPolicy: roomPolicy("standard"),
    privacyMode: "standard",
    roomLifecycle: "active_local",
    membership: membership(),
    providerStatus: NULL_STATUS,
    providerCapabilities: NULL_CAPS,
    assessment: unverifiedAssessment(),
    ...over,
  });
}

describe("Sentinel leak traps", () => {
  it("errors never contain the sentinel or identifiers", () => {
    const errors = [
      new SecureDeviceError("assessment_invalid"),
      new SensitiveRoomAdmissionDeniedError("deny_minimum_posture"),
      new SensitiveRoomSessionStaleError("assessment_stale"),
      new DevicePostureAssessmentInvalidError(),
    ];
    for (const e of errors) {
      expect(e.message).not.toContain(SECURE_DEVICE_SENTINEL);
      expect(String(e.stack ?? "")).not.toContain(SECURE_DEVICE_SENTINEL);
      expect(JSON.stringify(e, Object.getOwnPropertyNames(e))).not.toContain(
        SECURE_DEVICE_SENTINEL,
      );
    }
  });

  it("hostile sentinel-bearing input never leaks into a decision", () => {
    // A forged assessment carrying the sentinel in its reasonCodes must not be
    // accepted, and the resulting decision must echo only our own codes.
    const hostile = forgedAssessment({ reasonCodes: [SECURE_DEVICE_SENTINEL] });
    const d = admit({ assessment: hostile, roomPolicy: requiring("unverified") });
    const serialized = JSON.stringify(d);
    expect(serialized).not.toContain(SECURE_DEVICE_SENTINEL);
    // Provenance rejected → treated as unverified, revision 0.
    expect(d.assessmentRevision).toBe(0);
  });

  it("the sentinel appears nowhere in shipped module source", () => {
    for (const file of readdirSync(SECURE_DEVICE_DIR)) {
      const src = readFileSync(join(SECURE_DEVICE_DIR, file), "utf8");
      expect(src, file).not.toContain(SECURE_DEVICE_SENTINEL);
    }
  });
});

describe("Side-effect traps (§23: 29-30)", () => {
  it("the module imports no storage/network/notification/AI/endpoint sink", () => {
    const forbiddenImports = [
      "@freelayer/storage",
      "@freelayer/transports",
      "@freelayer/ai",
      "node:fs",
      "node:net",
      "node:http",
    ];
    const forbiddenCalls = ["fetch(", "XMLHttpRequest", "WebSocket(", "sendBeacon", "localStorage"];
    for (const file of readdirSync(SECURE_DEVICE_DIR)) {
      const src = readFileSync(join(SECURE_DEVICE_DIR, file), "utf8");
      for (const imp of forbiddenImports) {
        expect(src.includes(`"${imp}"`), `${file} imports ${imp}`).toBe(false);
      }
      for (const call of forbiddenCalls) {
        expect(src.includes(call), `${file} calls ${call}`).toBe(false);
      }
    }
  });

  it("a denied admission produces no session and no throw-with-content", () => {
    const denied = admit({ roomPolicy: requiring("hardened") });
    expect(denied.allowed).toBe(false);
    // No admitted session can be minted; the thrown error is content-free.
    try {
      createSensitiveRoomSessionV1({
        decision: denied,
        privacyMode: "standard",
        protectedContentRequirement: "policy_redaction_only",
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SensitiveRoomAdmissionDeniedError);
      expect((e as Error).message).not.toContain(SECURE_DEVICE_SENTINEL);
    }
  });
});

describe("Matrix / Storage / Metadata agree (§23: 31)", () => {
  it("raw evidence + identifiers + history + inventory are denied", () => {
    for (const op of [
      "room.raw_device_evidence.input",
      "room.raw_device_evidence.persist",
      "room.device_identifier.collect",
      "room.device_assessment_history.persist",
      "room.device_inventory.collect",
    ]) {
      const d = evaluatePolicyMatrix({ mode: "standard", domain: "room", operation: op });
      expect(d.allowed, op).toBe(false);
    }
  });

  it("posture elevation + ScreenShield/Bunker gates stay future/denied", () => {
    expect(
      evaluatePolicyMatrix({
        mode: "standard",
        domain: "room",
        operation: "room.device_posture.elevate",
      }).allowed,
    ).toBe(false);
    for (const op of [
      "room.secure_device.provider_elevation",
      "room.secure_device.screen_shield_require",
      "room.secure_device.bunker_session_require",
    ]) {
      const d = evaluatePolicyMatrix({ mode: "standard", domain: "room", operation: op });
      expect(d.effect, op).toBe("future_gate");
      expect(d.allowed, op).toBe(false);
    }
  });

  it("admission decisions never persist or egress; storage/metadata agree", () => {
    // Content read admission is memory-only in the matrix.
    const m = evaluatePolicyMatrix({
      mode: "standard",
      domain: "room",
      operation: "room.secure_device.content_read",
    });
    expect(m.persistentAllowed).toBe(false);
    expect(m.networkAllowed).toBe(false);
    // Device risk / posture state never persists (StoragePolicy).
    const storage = resolveStoragePolicy({
      mode: "standard",
      dataClass: "device_risk_state",
      sensitivity: "sensitive_metadata",
    });
    expect(storage.persistentAllowed).toBe(false);
    // Posture is sensitive metadata; a persistent sink is denied (MetadataPolicy).
    const meta = resolveMetadataPolicy({
      mode: "standard",
      event: "protected_content.revealed",
      sink: "local_persistent_storage",
    });
    expect(meta.allowed).toBe(false);
  });
});

describe("Guardrail + externalization (§23: 32-33)", () => {
  it("the core-boundary guardrail passes on real code and fails on the fixture", () => {
    const real = spawnSync(
      process.execPath,
      ["scripts/check-no-secure-device-core-implementation.mjs"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(real.status).toBe(0);
    expect(real.stdout).toContain("OK");

    const fixture = spawnSync(
      process.execPath,
      [
        "scripts/check-no-secure-device-core-implementation.mjs",
        "tests/fixtures/secure-device-core-implementation",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(fixture.status).toBe(1);
    expect(fixture.stderr).toContain("FAILED");
  });

  it("PBOM and Trust Center remain honest about Secure Device (32)", () => {
    const pbom = readFileSync("docs/PBOM.md", "utf8").toLowerCase();
    expect(pbom).toContain("secure device");
    expect(pbom).toContain("null provider");
    const trust = readFileSync("docs/TRUST_CENTER.md", "utf8").toLowerCase();
    expect(trust).toContain("secure device");
    // No overclaim scan (spawned) passes on the Trust Center.
    const scan = spawnSync(
      process.execPath,
      ["scripts/check-policy-conflicts.mjs", "--trust-center", "docs/TRUST_CENTER.md"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(scan.status).toBe(0);
  });

  it("GrapheneOS management / MDM / attestation / anti-spyware are absent (33)", () => {
    // The endpoint-boundary docs exist and disclaim implementation.
    expect(existsSync("docs/ENDPOINT_DEFENSE_MODEL.md")).toBe(true);
    const endpoint = readFileSync("docs/ENDPOINT_DEFENSE_MODEL.md", "utf8").toLowerCase();
    expect(endpoint).toContain("external");
    // Session revalidation stays fail-closed (documented recovery).
    const decision = admit({ roomPolicy: requiring("unverified") });
    const session = createSensitiveRoomSessionV1({
      decision,
      privacyMode: "standard",
      protectedContentRequirement: "policy_redaction_only",
    });
    expect(() =>
      assertSensitiveRoomSessionCurrentV1({
        session,
        current: {
          assessmentRevision: session.assessmentRevision,
          roomPolicyRevision: session.roomPolicyRevision,
          privacyMode: "standard",
          roomLifecycle: "active_local",
          effectivePosture: "at_risk",
          providerLifecycle: "not_integrated",
          freshness: "current_process_only",
          protectedContentRequirement: "policy_redaction_only",
          action: "room.content.read",
        },
      }),
    ).toThrow(SensitiveRoomSessionStaleError);
  });
});
