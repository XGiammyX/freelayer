/**
 * Security-regression (TECH-ID-05 §32): per-contact alias boundary proofs.
 *
 *  - Sentinel + redaction: no alias/label text or leak sentinel escapes into
 *    errors or redacted surfaces (audit events, reuse assessment, strict display).
 *  - Side-effect scope traps: every write needs an AUTHENTIC exact-scope decision;
 *    forged / wrong-scope / denied decisions are refused; the repository refuses a
 *    non-alias scope.
 *  - Matrix ↔ policy agreement: the runtime policy allow/deny matches the Policy
 *    Matrix rows for all 9 alias operations across all 7 modes.
 *  - Structural absence proofs: network sharing / public directory / global
 *    username / authentication / cryptographic binding / persistent plaintext /
 *    notification / telemetry / AI are false in EVERY mode; the always-forbidden
 *    matrix specs are never allowed.
 *  - Guardrail: the shipped alias code passes the bypass guard; the fixture fails.
 *  - Not-identity proofs: DevicePosture / room role / ScreenShield fields are
 *    rejected; an alias never carries a verified/authenticated flag.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyContactAliasCommandV1,
  assessContactAliasReuseV1,
  buildContactAliasAuditEventV1,
  buildContactDisplayContextV1,
  ContactAliasDecisionMismatchError,
  ContactAliasPolicyDeniedError,
  ContactAliasValidationError,
  CONTACT_ALIAS_OPERATIONS,
  InMemoryContactAliasRepositoryV1,
  normalizeContactAliasDisplayTextV1,
  resolveContactAliasPolicyV1,
  validateContactAliasCommandV1,
  type ContactAliasOperationV1,
} from "@freelayer/identity";
import { issuePolicyDecision, POLICY_MATRIX_RULES, type PrivacyMode } from "@freelayer/privacy";
import {
  ALIAS_SENTINEL,
  applyA,
  CLOCK,
  emptyState,
  nextIds,
  ref,
  repo,
} from "../../../fixtures/contact-aliases/v1/helpers";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const MODES: readonly PrivacyMode[] = [
  "standard",
  "private",
  "ghost",
  "bunker",
  "offline_capsule",
  "emergency",
  "sovereign_room",
];

function errText(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return `${String(error)}\n${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
  }
  throw new Error("expected the operation to throw");
}

describe("Sentinel + redaction — text never leaks into errors or redacted output", () => {
  it("normalization / pipeline errors never echo the alias text or sentinel", () => {
    // Invalid text carrying the sentinel: the error is content-free.
    expect(
      errText(() => normalizeContactAliasDisplayTextV1(`${ALIAS_SENTINEL}\u0000`)),
    ).not.toContain(ALIAS_SENTINEL);
    // A create with a forged decision fails BEFORE storing; error stays redacted.
    const r = ref();
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.alias.presentation.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    const leaked = errText(() =>
      applyContactAliasCommandV1({
        state: emptyState(),
        command: {
          schemaVersion: 1,
          command: "identity.alias.presentation.create",
          relationshipId: r.relationshipId,
          rootId: r.rootId,
          personaId: r.personaId,
          displayText: ALIAS_SENTINEL,
        },
        mode: "standard",
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
        relationshipRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
        clockValue: CLOCK,
        repository: repo(),
      }),
    );
    expect(leaked).not.toContain(ALIAS_SENTINEL);
  });

  it("redacted audit + reuse-assessment surfaces carry no free text", () => {
    const audit = buildContactAliasAuditEventV1({
      operationCategory: "local_peer_label_lifecycle",
      outcome: "denied",
      mode: "ghost",
      reasonCode: "local_peer_label_denied",
    });
    expect(audit.redacted).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(ALIAS_SENTINEL);
    const reuse = assessContactAliasReuseV1({
      state: emptyState(),
      normalizedValue: normalizeContactAliasDisplayTextV1(ALIAS_SENTINEL).normalizedValue,
      forRelationshipId: ref().relationshipId,
    });
    expect(reuse.relationshipIdsExposed).toBe(false);
    expect(reuse.otherRelationshipCountExposed).toBe(false);
  });

  it("a local peer label (sentinel) is redacted from a strict-mode display context", () => {
    const r = ref();
    const labelId = nextIds().labelId;
    const withLabel = applyA({
      state: emptyState(),
      command: {
        schemaVersion: 1,
        command: "identity.alias.local_peer_label.set",
        relationshipId: r.relationshipId,
        rootId: r.rootId,
        personaId: r.personaId,
        labelText: ALIAS_SENTINEL,
      },
      scope: "identity.alias.local_peer_label.write",
      relationshipRef: r,
      generatedIds: { labelId },
    }).state;
    // State legitimately holds the label in memory, but it is peer-private…
    expect(withLabel.localPeerLabels[0]!.peerShared).toBe(false);
    expect(withLabel.localPeerLabels[0]!.visibility).toBe("local_only");
    // …and a strict/redacted display context does not surface it at all.
    const priv = buildContactDisplayContextV1({
      ref: r,
      state: withLabel,
      policy: resolveContactAliasPolicyV1({ mode: "private", operation: "display_context.read" }),
    });
    expect(priv.redacted).toBe(true);
    expect(JSON.stringify(priv)).not.toContain(ALIAS_SENTINEL);
  });
});

describe("Side-effect scope traps", () => {
  const r = ref();
  const create = {
    schemaVersion: 1,
    command: "identity.alias.presentation.create",
    relationshipId: r.relationshipId,
    rootId: r.rootId,
    personaId: r.personaId,
    displayText: "Blue Fox",
  } as const;

  it("wrong-scope, denied, and forged decisions are all refused", () => {
    const base = {
      state: emptyState(),
      command: create,
      mode: "standard" as const,
      relationshipRef: r,
      generatedIds: { aliasId: nextIds().aliasId },
      clockValue: CLOCK,
      repository: repo(),
    };
    // Wrong scope (a real, authentic decision for a different alias side effect).
    expect(() =>
      applyContactAliasCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "allowed",
          "standard",
          "identity.alias.local_peer_label.write",
        ),
      }),
    ).toThrow(ContactAliasDecisionMismatchError);
    // Denied verdict for the correct scope.
    expect(() =>
      applyContactAliasCommandV1({
        ...base,
        decision: issuePolicyDecision(
          "persistence",
          "denied",
          "standard",
          "identity.alias.presentation.create",
        ),
      }),
    ).toThrow(ContactAliasDecisionMismatchError);
    // Forged (non-authentic) object masquerading as a decision.
    const forged = {
      id: "x",
      capability: "persistence",
      sideEffect: "identity.alias.presentation.create",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    };
    expect(() =>
      applyContactAliasCommandV1({
        ...base,
        decision: forged as unknown as ReturnType<typeof issuePolicyDecision>,
      }),
    ).toThrow(ContactAliasDecisionMismatchError);
  });

  it("the repository refuses a decision whose scope is not an alias side effect", () => {
    const memo = new InMemoryContactAliasRepositoryV1();
    const nonAlias = issuePolicyDecision("persistence", "allowed", "standard", "storage.write");
    expect(() => memo.replace(emptyState(), nonAlias)).toThrow();
  });
});

describe("Matrix ↔ policy agreement (9 ops × 7 modes)", () => {
  const MATRIX_OP_TO_ALIAS_OP: Readonly<Record<string, ContactAliasOperationV1>> = {
    "identity.alias.presentation.create": "presentation.create",
    "identity.alias.presentation.activate": "presentation.activate",
    "identity.alias.presentation.rotate": "presentation.rotate",
    "identity.alias.presentation.retire": "presentation.retire",
    "identity.alias.local_peer_label.set": "local_peer_label.set",
    "identity.alias.local_peer_label.replace": "local_peer_label.replace",
    "identity.alias.local_peer_label.clear": "local_peer_label.clear",
    "identity.alias.display_context.read": "display_context.read",
    "identity.alias.reuse_assessment.read": "reuse_assessment.read",
  };

  it("every operational alias matrix rule matches the runtime policy verdict", () => {
    const operational = POLICY_MATRIX_RULES.filter(
      (rule) => rule.domain === "identity" && rule.operation in MATRIX_OP_TO_ALIAS_OP,
    );
    // 9 operations across 7 modes.
    expect(operational).toHaveLength(9 * MODES.length);
    for (const rule of operational) {
      const operation = MATRIX_OP_TO_ALIAS_OP[rule.operation]!;
      const policy = resolveContactAliasPolicyV1({ mode: rule.mode, operation });
      expect(policy.allowed, `${rule.operation}:${rule.mode}`).toBe(rule.allowed);
    }
  });
});

describe("Structural absence proofs", () => {
  it("no mode/op ever enables sharing, directory, username, auth, crypto, persistence, notification, telemetry, AI", () => {
    for (const mode of MODES) {
      for (const operation of CONTACT_ALIAS_OPERATIONS) {
        const p = resolveContactAliasPolicyV1({ mode, operation });
        expect(p.networkSharingAllowed).toBe(false);
        expect(p.publicDirectoryAllowed).toBe(false);
        expect(p.globalUsernameAllowed).toBe(false);
        expect(p.authenticationAvailable).toBe(false);
        expect(p.cryptographicBindingAvailable).toBe(false);
        expect(p.persistentPlaintextAllowed).toBe(false);
        expect(p.notificationAllowed).toBe(false);
        expect(p.telemetryAllowed).toBe(false);
        expect(p.aiAllowed).toBe(false);
      }
    }
  });

  it("always-forbidden / not-implemented / future-gated alias specs are never allowed", () => {
    const forbidden = new Set([
      "identity.alias_remote_sharing",
      "identity.alias_public_directory",
      "identity.alias_username_search",
      "identity.alias_authenticated_update_future",
      "identity.alias_persistence",
      "identity.alias_history",
    ]);
    const rules = POLICY_MATRIX_RULES.filter((rule) => forbidden.has(rule.id.split(":")[0]!));
    expect(rules.length).toBe(forbidden.size * MODES.length);
    for (const rule of rules) expect(rule.allowed, rule.id).toBe(false);
  });
});

describe("Guardrail (spawned)", () => {
  const script = "scripts/check-no-contact-alias-bypass.mjs";
  it("shipped alias source passes the bypass guard", () => {
    expect(() =>
      execFileSync("node", [script, "packages/identity/src/aliases"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
  it("the intentional bypass fixture fails the guard", () => {
    expect(() =>
      execFileSync("node", [script, "tests/fixtures/contact-alias-bypass"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

describe("Not-identity proofs", () => {
  it("DevicePosture / room role / ScreenShield / auth caller fields are rejected", () => {
    for (const field of [
      "devicePosture",
      "roomRole",
      "isOwner",
      "isAdmin",
      "capabilities",
      "screenShieldActive",
      "authenticated",
      "verified",
    ]) {
      expect(
        () =>
          validateContactAliasCommandV1({
            schemaVersion: 1,
            command: "identity.alias.presentation.retire",
            aliasId: "alias-x",
            expectedRevision: 1,
            [field]: true,
          }),
        field,
      ).toThrow(ContactAliasValidationError);
    }
  });

  it("a built alias never claims verification, authentication, or cryptographic binding", () => {
    const { state } = applyA({
      state: emptyState(),
      command: {
        schemaVersion: 1,
        command: "identity.alias.presentation.create",
        relationshipId: ref().relationshipId,
        rootId: ref().rootId,
        personaId: ref().personaId,
        displayText: "Blue Fox",
      },
      scope: "identity.alias.presentation.create",
      relationshipRef: ref(),
      generatedIds: { aliasId: nextIds().aliasId },
    });
    const alias = state.presentationAliases[0]!;
    expect(alias.securityAssessment.verifiedIdentity).toBe(false);
    expect(alias.securityAssessment.impersonationSafe).toBe(false);
    expect(alias.authenticatedBinding).toBe("not_implemented_gate_f");
    expect(alias.sharingState).toBe("not_shared_tech_id_05");
  });

  it("Emergency mode denies expansive alias writes before any mutation", () => {
    const r = ref();
    expect(() =>
      applyA({
        state: emptyState(),
        command: {
          schemaVersion: 1,
          command: "identity.alias.presentation.create",
          relationshipId: r.relationshipId,
          rootId: r.rootId,
          personaId: r.personaId,
          displayText: "Blue Fox",
        },
        scope: "identity.alias.presentation.create",
        mode: "emergency",
        relationshipRef: r,
        generatedIds: { aliasId: nextIds().aliasId },
      }),
    ).toThrow(ContactAliasPolicyDeniedError);
  });
});
