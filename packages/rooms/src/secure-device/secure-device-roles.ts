/**
 * Secure Device integration ROLES (TECH-23) — RATS-aligned (RFC 9334).
 *
 * FreeLayer core is ONLY the future Relying Party. The Attester (produces
 * Evidence) and the Verifier (appraises Evidence → Attestation Results) live in
 * the SEPARATE Secure Device project. Core consumes a NORMALIZED assessment
 * result and applies its own room-admission policy — it never parses Evidence,
 * appraises firmware, inspects measurements, or infers posture from user agent,
 * OS name, device model, or membership. No provider is integrated (Gate:
 * Secure Device Integration Gate), so the relying-party role is future-only.
 */

export type SecureDeviceIntegrationRoleV1 =
  "secure_device_attester_external" | "secure_device_verifier_external" | "freelayer_relying_party";

export const SECURE_DEVICE_INTEGRATION_ROLES: readonly SecureDeviceIntegrationRoleV1[] = [
  "secure_device_attester_external",
  "secure_device_verifier_external",
  "freelayer_relying_party",
];

export interface SecureDeviceRoleDescriptorV1 {
  readonly role: SecureDeviceIntegrationRoleV1;
  /** Where the role is implemented — external project vs. FreeLayer core. */
  readonly ownedBy: "secure_device_external_project" | "freelayer_core";
  /** RATS mapping (documentation only — no Evidence is processed in core). */
  readonly ratsRole: "attester" | "verifier" | "relying_party";
  /** Core NEVER processes raw Evidence; true only for the external Verifier. */
  readonly processesRawEvidence: boolean;
  readonly reasonCode: string;
}

export const SECURE_DEVICE_ROLE_MODEL: Readonly<
  Record<SecureDeviceIntegrationRoleV1, SecureDeviceRoleDescriptorV1>
> = {
  secure_device_attester_external: {
    role: "secure_device_attester_external",
    ownedBy: "secure_device_external_project",
    ratsRole: "attester",
    processesRawEvidence: true, // in the EXTERNAL project only
    reasonCode: "external_attester",
  },
  secure_device_verifier_external: {
    role: "secure_device_verifier_external",
    ownedBy: "secure_device_external_project",
    ratsRole: "verifier",
    processesRawEvidence: true, // in the EXTERNAL project only
    reasonCode: "external_verifier",
  },
  freelayer_relying_party: {
    role: "freelayer_relying_party",
    ownedBy: "freelayer_core",
    ratsRole: "relying_party",
    processesRawEvidence: false, // core consumes only a normalized result
    reasonCode: "freelayer_relying_party",
  },
};

/** The single role FreeLayer core plays. Documented, future-only. */
export const FREELAYER_SECURE_DEVICE_ROLE: SecureDeviceIntegrationRoleV1 =
  "freelayer_relying_party";
