/**
 * Privacy-regression (TECH-ID-07 §34): device scope × lifecycle × capability ×
 * root-kind × DevicePosture-tightening matrix for stale-context invalidation.
 * Proves ordinary operations are permitted ONLY for an operational lifecycle,
 * a usable root, an unchanged revision, a still-covering scope, a still-present
 * capability, and no posture tightening — everything else fails closed.
 */
import { describe, expect, it } from "vitest";
import {
  assertDeviceAuthorizationSnapshotCurrentV1,
  deviceAuthorizationSnapshotV1,
  type DeviceAuthorizationRecordV1,
} from "@freelayer/identity";
import {
  applyD,
  bootstrapped,
  personaScope,
  readOnlyScope,
  rootRef,
} from "../../../fixtures/device-key-model/v1/helpers";

function recAfter(
  kind: "active" | "restricted" | "compromised" | "revoked",
): DeviceAuthorizationRecordV1 {
  const { state, authorizationId } = bootstrapped();
  if (kind === "active") return state.authorizations[0]!;
  if (kind === "restricted") {
    return applyD({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device.restrict",
        authorizationId,
        expectedRevision: 1,
      },
      scope: "identity.device.restrict",
    }).state.authorizations[0]!;
  }
  if (kind === "compromised") {
    return applyD({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device.mark_compromised",
        authorizationId,
        expectedRevision: 1,
      },
      scope: "identity.device.mark_compromised",
    }).state.authorizations[0]!;
  }
  return applyD({
    state,
    command: {
      schemaVersion: 1,
      command: "identity.device.revoke",
      authorizationId,
      expectedRevision: 1,
    },
    scope: "identity.device.revoke",
  }).state.authorizations[0]!;
}

describe("Lifecycle × root state matrix", () => {
  // label, lifecycle, rootRef override, postureTightens, expected-ok
  const rows: ReadonlyArray<
    readonly [
      string,
      "active" | "restricted" | "compromised" | "revoked",
      Parameters<typeof rootRef>[0],
      boolean,
      boolean,
    ]
  > = [
    ["active + usable root", "active", {}, false, true],
    ["restricted is still operational", "restricted", {}, false, true],
    ["compromised denies ordinary ops", "compromised", {}, false, false],
    ["revoked denies ordinary ops", "revoked", {}, false, false],
    ["active + posture tightening", "active", {}, true, false],
    [
      "active + root inactive (ephemeral epoch passed)",
      "active",
      { rootActive: false },
      false,
      false,
    ],
    ["active + root compromised", "active", { rootCompromised: true }, false, false],
    [
      "active + ephemeral usable root",
      "active",
      { rootKind: "ephemeral_current_process" },
      false,
      true,
    ],
  ];
  it.each(rows)("%s", (_label, kind, over, postureTightens, ok) => {
    const rec = recAfter(kind);
    const run = () =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: deviceAuthorizationSnapshotV1(rec),
        current: rec,
        rootRef: rootRef(over),
        postureTightens,
      });
    if (ok) expect(run).not.toThrow();
    else expect(run).toThrow();
  });
});

describe("Scope + capability coverage", () => {
  it("required scope must still be covered; required capability must still be present", () => {
    const rec = recAfter("active"); // persona scope + capabilities incl. summary.read
    const snap = deviceAuthorizationSnapshotV1(rec);
    // A read-only sub-scope of the persona scope is covered.
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: snap,
        current: rec,
        rootRef: rootRef(),
        requiredScope: readOnlyScope(),
      }),
    ).not.toThrow();
    // A wider (root) scope is NOT covered by a persona scope.
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: snap,
        current: rec,
        rootRef: rootRef(),
        requiredScope: { kind: "identity_root", rootId: personaScope().rootId, readOnly: false },
      }),
    ).toThrow();
    // A present capability passes; an absent one fails.
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: snap,
        current: rec,
        rootRef: rootRef(),
        requiredCapability: "identity.summary.read",
      }),
    ).not.toThrow();
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: snap,
        current: rec,
        rootRef: rootRef(),
        requiredCapability: "identity.room_binding.use",
      }),
    ).toThrow();
  });

  it("a stale (revision-drifted) snapshot fails against the current record", () => {
    const rec = recAfter("active");
    const stale = { ...deviceAuthorizationSnapshotV1(rec), revision: 99 as never };
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: stale,
        current: rec,
        rootRef: rootRef(),
      }),
    ).toThrow();
  });
});
