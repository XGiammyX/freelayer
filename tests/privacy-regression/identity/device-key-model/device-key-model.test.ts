/**
 * Privacy-regression (TECH-ID-07): device key model — opaque local device refs,
 * root-subordinate authorization, scopes + capabilities (attenuation-only),
 * purpose-separated EMPTY key slots, bootstrap placeholder, restrict/compromise/
 * revoke lifecycle, stale-context invalidation, memory/null retention. Covers
 * §33 behaviorally.
 */
import { describe, expect, it } from "vitest";
import {
  applyDeviceKeyModelCommandV1,
  assertDeviceAuthorizationSnapshotCurrentV1,
  attenuateDeviceAuthorizationScopeV1,
  attenuateDeviceCapabilitiesV1,
  deviceAuthorizationSnapshotV1,
  DeviceAdditionUnavailableError,
  DeviceAuthorizationLifecycleError,
  DeviceAuthorizationRevisionMismatchError,
  DeviceAuthorizationScopeError,
  DeviceCapabilityAttenuationError,
  DeviceKeyModelValidationError,
  DeviceKeyPurposeError,
  DevicePassportUnavailableError,
  InMemoryDeviceKeyModelRepositoryV1,
  NullDeviceKeyModelRepositoryV1,
  validateDeviceKeyModelCommandV1,
  validateLocalDeviceRef,
} from "@freelayer/identity";
import { issuePolicyDecision } from "@freelayer/privacy";
import {
  applyD,
  bootstrapCommand,
  bootstrapped,
  CLOCK,
  decisionFor,
  emptyState,
  nextIds,
  personaScope,
  readOnlyScope,
  repo,
  rootRef,
  rootScope,
  PERSONA,
  ROOT,
} from "../../../fixtures/device-key-model/v1/helpers";

describe("Identifiers + validation (§33: 1-9, 14-17)", () => {
  it("device ref is opaque local; hardware/key/posture fields reject", () => {
    expect(validateLocalDeviceRef("dev-a1")).toBe("dev-a1");
    expect(() => validateLocalDeviceRef("dev-Serial 123")).toThrow();
    for (const field of [
      "publicKey",
      "privateKey",
      "secretKey",
      "seed",
      "mnemonic",
      "signature",
      "certificate",
      "hardwareId",
      "serialNumber",
      "imei",
      "macAddress",
      "advertisingId",
      "hostname",
      "osBuild",
      "attestation",
      "devicePosture",
      "screenShieldActive",
      "trusted",
      "verified",
      "primary",
      "owner",
      "admin",
      "superuser",
      "linked",
      "passport",
      "remote",
      "synchronized",
    ]) {
      expect(
        () =>
          validateDeviceKeyModelCommandV1({
            schemaVersion: 1,
            command: "identity.device.revoke",
            authorizationId: "devauth-a1",
            expectedRevision: 1,
            [field]: "x",
          }),
        field,
      ).toThrow();
    }
  });

  it("unknown command / dangerous keys reject; future-gated commands are unavailable", () => {
    expect(() =>
      validateDeviceKeyModelCommandV1({ schemaVersion: 1, command: "identity.device.boom" }),
    ).toThrow(DeviceKeyModelValidationError);
    expect(() =>
      validateDeviceKeyModelCommandV1({
        schemaVersion: 2,
        command: "identity.device.revoke",
        authorizationId: "devauth-a1",
        expectedRevision: 1,
      }),
    ).toThrow();
    expect(() =>
      validateDeviceKeyModelCommandV1({
        schemaVersion: 1,
        command: "identity.device.revoke",
        authorizationId: "devauth-a1",
        expectedRevision: 1,
        ["__proto__"]: {},
      }),
    ).toThrow();
    // No second device: add/link/import are unavailable.
    for (const c of [
      "identity.device.add_remote",
      "identity.device.link",
      "identity.device.approve_qr",
      "identity.device.import",
      "identity.device.copy_root_secret",
    ]) {
      expect(() => validateDeviceKeyModelCommandV1({ schemaVersion: 1, command: c }), c).toThrow(
        DeviceAdditionUnavailableError,
      );
    }
    // Device Passport / attestation unavailable.
    for (const c of ["identity.device.issue_passport", "identity.device.verify_attestation"]) {
      expect(() => validateDeviceKeyModelCommandV1({ schemaVersion: 1, command: c }), c).toThrow(
        DevicePassportUnavailableError,
      );
    }
  });
});

describe("Bootstrap semantics (§33: 10-13, 26-31)", () => {
  it("bootstrap requires exact decision + root ref; creates placeholder + reserved empty slots", () => {
    const st = bootstrapped().state;
    const rec = st.authorizations[0]!;
    expect(rec.deviceClass).toBe("current_installation_placeholder");
    expect(rec.lifecycle).toBe("active_local_unverified");
    expect(rec.cryptographicallyAuthorized).toBe(false);
    expect(rec.authorizationProofState).toBe("local_unverified_placeholder");
    const slot = st.keySlots[0]!;
    expect(slot.lifecycle).toBe("reserved_not_generated");
    expect(slot.algorithm).toBe("not_selected_gate_f");
    expect(slot.publicMaterialPresent).toBe(false);
    expect(slot.privateMaterialPresent).toBe(false);
    expect(slot.keyReuseAcrossPurposes).toBe("forbidden");
  });

  it("fake / wrong-scope decisions reject; missing root ref rejects", () => {
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.device.bootstrap",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyDeviceKeyModelCommandV1({
        state: emptyState(),
        command: bootstrapCommand(),
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        rootRef: rootRef(),
        generatedIds: nextIds(),
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow();
    expect(() =>
      applyDeviceKeyModelCommandV1({
        state: emptyState(),
        command: bootstrapCommand(),
        mode: "standard",
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.device.revoke",
        ),
        rootRef: rootRef(),
        generatedIds: nextIds(),
        clockValue: CLOCK,
        repository: repo(),
      }),
    ).toThrow();
    expect(() =>
      applyD({
        state: emptyState(),
        command: bootstrapCommand(),
        scope: "identity.device.bootstrap",
        generatedIds: nextIds(),
      }),
    ).toThrow();
  });

  it("duplicate bootstrap rejects (no second device via bootstrap)", () => {
    const { state } = bootstrapped();
    expect(() =>
      applyD({
        state,
        command: bootstrapCommand(),
        scope: "identity.device.bootstrap",
        rootRef: rootRef(),
        generatedIds: nextIds(),
      }),
    ).toThrow(DeviceAdditionUnavailableError);
  });

  it("one key slot has one purpose; duplicate purpose + unknown purpose reject", () => {
    expect(() =>
      validateDeviceKeyModelCommandV1(
        bootstrapCommand({ keySlotPurposes: ["room_messaging_future", "room_messaging_future"] }),
      ),
    ).toThrow(DeviceKeyPurposeError);
    expect(() =>
      validateDeviceKeyModelCommandV1(bootstrapCommand({ keySlotPurposes: ["not_a_purpose"] })),
    ).toThrow(DeviceKeyPurposeError);
  });

  it("bootstrap cannot grant future add/recovery capabilities", () => {
    expect(() =>
      validateDeviceKeyModelCommandV1(
        bootstrapCommand({ capabilities: ["identity.device.add_future"] }),
      ),
    ).toThrow();
    expect(() =>
      validateDeviceKeyModelCommandV1(
        bootstrapCommand({ capabilities: ["identity.recovery.approve_future"] }),
      ),
    ).toThrow();
  });
});

describe("Scope + capability model (§33: 18-25)", () => {
  it("scope validation enforces shape; cross-root + wildcard reject", () => {
    // Room scope requires a room binding.
    expect(() =>
      validateDeviceKeyModelCommandV1(
        bootstrapCommand({
          scope: {
            kind: "room",
            rootId: ROOT as unknown as string,
            personaId: PERSONA as unknown as string,
            readOnly: false,
          } as never,
        }),
      ),
    ).toThrow(DeviceAuthorizationScopeError);
    // Cross-root scope (scope.rootId != command.rootId).
    expect(() =>
      validateDeviceKeyModelCommandV1(
        bootstrapCommand({
          scope: {
            kind: "identity_root",
            rootId: "idr-other" as unknown as string,
            readOnly: false,
          } as never,
        }),
      ),
    ).toThrow(DeviceAuthorizationScopeError);
  });

  it("scope attenuation cannot widen; room cannot move; read-only cannot become writable", () => {
    // root -> persona narrows (ok).
    expect(
      attenuateDeviceAuthorizationScopeV1({ current: rootScope(), requested: personaScope() }).kind,
    ).toBe("persona");
    // persona -> root widens (reject).
    expect(() =>
      attenuateDeviceAuthorizationScopeV1({ current: personaScope(), requested: rootScope() }),
    ).toThrow(DeviceAuthorizationScopeError);
    // read-only -> writable (reject).
    expect(() =>
      attenuateDeviceAuthorizationScopeV1({ current: readOnlyScope(), requested: rootScope() }),
    ).toThrow(DeviceAuthorizationScopeError);
    // cross-root (reject).
    expect(() =>
      attenuateDeviceAuthorizationScopeV1({
        current: rootScope(),
        requested: { kind: "identity_root", rootId: "idr-other" as never, readOnly: false },
      }),
    ).toThrow(DeviceAuthorizationScopeError);
  });

  it("capability attenuation can only remove; unknown capability denies", () => {
    const cur = [
      "identity.summary.read",
      "identity.persona.use",
      "identity.device.revoke",
    ] as never;
    expect(attenuateDeviceCapabilitiesV1(cur, ["identity.summary.read"] as never)).toEqual([
      "identity.summary.read",
    ]);
    expect(() =>
      attenuateDeviceCapabilitiesV1(cur, ["identity.room_binding.use"] as never),
    ).toThrow(DeviceCapabilityAttenuationError);
    expect(() => attenuateDeviceCapabilitiesV1(cur, ["nope"] as never)).toThrow(
      DeviceCapabilityAttenuationError,
    );
  });
});

describe("Restrict / compromise / revoke (§33: 32-41)", () => {
  it("restrict narrows + bumps revision + invalidates stale snapshots", () => {
    const { state, authorizationId } = bootstrapped();
    const snap = deviceAuthorizationSnapshotV1(state.authorizations[0]!);
    const restricted = applyD({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device.restrict",
        authorizationId,
        expectedRevision: 1,
        requestedCapabilities: ["identity.summary.read"],
      },
      scope: "identity.device.restrict",
    }).state;
    const rec = restricted.authorizations[0]!;
    expect(rec.lifecycle).toBe("restricted_local");
    expect(rec.revision).toBe(2);
    expect(rec.capabilities).toEqual(["identity.summary.read"]);
    // The old snapshot is now stale.
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: snap,
        current: rec,
        rootRef: rootRef(),
      }),
    ).toThrow(DeviceAuthorizationRevisionMismatchError);
  });

  it("compromised denies ordinary ops via snapshot; revoke is terminal + marks slots revoked, no remote action", () => {
    const { state, authorizationId } = bootstrapped();
    const compromised = applyD({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device.mark_compromised",
        authorizationId,
        expectedRevision: 1,
      },
      scope: "identity.device.mark_compromised",
    }).state;
    const cRec = compromised.authorizations[0]!;
    expect(cRec.lifecycle).toBe("compromised_suspected");
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: deviceAuthorizationSnapshotV1(cRec),
        current: cRec,
        rootRef: rootRef(),
      }),
    ).toThrow(DeviceAuthorizationLifecycleError);
    // Revoke (from compromised).
    const revoked = applyD({
      state: compromised,
      command: {
        schemaVersion: 1,
        command: "identity.device.revoke",
        authorizationId,
        expectedRevision: 2,
      },
      scope: "identity.device.revoke",
    }).state;
    expect(revoked.authorizations[0]!.lifecycle).toBe("revoked_tombstone");
    expect(revoked.keySlots.every((s) => s.lifecycle === "revoked_tombstone")).toBe(true);
    // Revoked cannot reactivate (no transition to active/restricted).
    expect(() =>
      applyD({
        state: revoked,
        command: {
          schemaVersion: 1,
          command: "identity.device.restrict",
          authorizationId,
          expectedRevision: 3,
        },
        scope: "identity.device.restrict",
      }),
    ).toThrow();
  });

  it("root revocation/compromise invalidates child device operations", () => {
    const { state } = bootstrapped();
    const rec = state.authorizations[0]!;
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: deviceAuthorizationSnapshotV1(rec),
        current: rec,
        rootRef: rootRef({ rootCompromised: true }),
      }),
    ).toThrow(DeviceAuthorizationLifecycleError);
    expect(() =>
      assertDeviceAuthorizationSnapshotCurrentV1({
        snapshot: deviceAuthorizationSnapshotV1(rec),
        current: rec,
        rootRef: rootRef({ rootActive: false }),
      }),
    ).toThrow(DeviceAuthorizationLifecycleError);
  });
});

describe("Label + repositories + ephemeral (§33: 45-56)", () => {
  it("label is private; set + clear; ephemeral root cannot bootstrap when epoch passed", () => {
    const { state, deviceRef } = bootstrapped();
    const withLabel = applyD({
      state,
      command: {
        schemaVersion: 1,
        command: "identity.device.label.set",
        deviceRef,
        expectedRevision: 1,
        labelText: "Laptop",
      },
      scope: "identity.device.label.write",
    }).state;
    const label = withLabel.labels[0]!;
    expect(label.visibility).toBe("local_only");
    expect(label.peerShared).toBe(false);
    expect(label.authority).toBe("none");
    const cleared = applyD({
      state: withLabel,
      command: {
        schemaVersion: 1,
        command: "identity.device.label.clear",
        deviceRef,
        expectedRevision: 1,
      },
      scope: "identity.device.label.clear",
    }).state;
    expect(cleared.labels).toHaveLength(0);
    // Ephemeral root whose process epoch passed → rootActive false → bootstrap denies.
    expect(() =>
      applyD({
        state: emptyState(),
        command: bootstrapCommand(),
        scope: "identity.device.bootstrap",
        rootRef: rootRef({ rootKind: "ephemeral_current_process", rootActive: false }),
        generatedIds: nextIds(),
      }),
    ).toThrow();
  });

  it("memory repository clones; null retains nothing", () => {
    const m = new InMemoryDeviceKeyModelRepositoryV1();
    const d = decisionFor("identity.device.bootstrap");
    const st = emptyState();
    m.replace(st, d);
    expect(m.read(d)).not.toBe(st);
    const n = new NullDeviceKeyModelRepositoryV1();
    expect(n.replace(st, d).outcome).toBe("discarded");
    expect(n.read(d)).toBeNull();
  });
});
