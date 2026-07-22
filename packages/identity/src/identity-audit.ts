/**
 * Redacted local identity audit events (TECH-ID-03). Content-free: no root/
 * persona/relationship/binding id, no local labels, no room ids, no membership
 * ids, no timestamps by default, no command payload, no state dump, no sentinel.
 * `redacted` is structurally `true`. Not persisted by default.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { IdentityOperationV1 } from "./identity-policy";

export type IdentityAuditOperationCategoryV1 =
  "root_lifecycle" | "persona_lifecycle" | "relationship_lifecycle" | "room_binding_lifecycle";

export interface IdentityAuditEventV1 {
  readonly schemaVersion: 1;
  readonly operationCategory: IdentityAuditOperationCategoryV1;
  readonly outcome: "allowed" | "denied";
  readonly mode: PrivacyMode;
  readonly reasonCode: string;
  readonly redacted: true;
}

/** Map an operation to its audit category (summary reads are not audited here). */
export function identityAuditCategoryForOperationV1(
  operation: IdentityOperationV1,
): IdentityAuditOperationCategoryV1 | undefined {
  if (operation.startsWith("root.")) return "root_lifecycle";
  if (operation.startsWith("persona.")) return "persona_lifecycle";
  if (operation.startsWith("relationship.")) return "relationship_lifecycle";
  if (operation.startsWith("room_binding.")) return "room_binding_lifecycle";
  return undefined;
}

/** Build a redacted audit event. Never includes ids/labels/payload/sentinel. */
export function buildIdentityAuditEventV1(input: {
  operationCategory: IdentityAuditOperationCategoryV1;
  outcome: "allowed" | "denied";
  mode: PrivacyMode;
  reasonCode: string;
}): IdentityAuditEventV1 {
  return {
    schemaVersion: 1,
    operationCategory: input.operationCategory,
    outcome: input.outcome,
    mode: input.mode,
    reasonCode: input.reasonCode,
    redacted: true,
  };
}
