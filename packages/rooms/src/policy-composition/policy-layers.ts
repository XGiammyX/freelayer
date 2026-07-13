/**
 * Policy-composition layers + composed effects + strictness ordering (TECH-22).
 *
 * Fixed layer taxonomy (no dynamic caller-controlled names). Composition uses
 * DENY-OVERRIDES + STRICTEST-POLICY-WINS — never permit-overrides, never
 * first-applicable ordering that lets a later room rule bypass a global denial.
 * Every layer contributes constraints; the strictest result wins.
 */

export type RoomPolicyLayerV1 =
  | "global_constitution"
  | "policy_matrix"
  | "privacy_mode"
  | "device_posture"
  | "room_policy"
  | "membership_policy"
  | "object_policy"
  | "operation_policy"
  | "storage_policy"
  | "network_policy"
  | "metadata_policy"
  | "notification_policy"
  | "emergency_override";

export const ROOM_POLICY_LAYERS: readonly RoomPolicyLayerV1[] = [
  "global_constitution",
  "policy_matrix",
  "privacy_mode",
  "device_posture",
  "room_policy",
  "membership_policy",
  "object_policy",
  "operation_policy",
  "storage_policy",
  "network_policy",
  "metadata_policy",
  "notification_policy",
  "emergency_override",
];

export type RoomComposedPolicyEffectV1 =
  | "deny"
  | "null"
  | "not_implemented"
  | "future_gate"
  | "memory_only"
  | "redact"
  | "coarsen"
  | "require_user_action"
  | "allow";

/**
 * Strictness rank — HIGHER = stricter. `deny`/`not_implemented`/`future_gate`
 * are the strictest (never permit execution); `allow` is the loosest. Unknown
 * effects are treated as strictest (deny) by `strictestEffect`.
 */
const STRICTNESS: Readonly<Record<RoomComposedPolicyEffectV1, number>> = {
  deny: 100,
  not_implemented: 95,
  future_gate: 90,
  null: 80,
  require_user_action: 70,
  redact: 60,
  coarsen: 50,
  memory_only: 40,
  allow: 0,
};

/** Effects that DO NOT permit execution (fail-closed set). */
const NON_PERMITTING: ReadonlySet<RoomComposedPolicyEffectV1> = new Set([
  "deny",
  "not_implemented",
  "future_gate",
]);

export function effectStrictnessV1(effect: RoomComposedPolicyEffectV1): number {
  return STRICTNESS[effect] ?? STRICTNESS.deny;
}

export function effectPermitsExecutionV1(effect: RoomComposedPolicyEffectV1): boolean {
  if (!(effect in STRICTNESS)) return false; // unknown → deny
  return !NON_PERMITTING.has(effect);
}

/** The strictest (highest-rank) of two effects. Unknown → deny. */
export function strictestEffectV1(
  a: RoomComposedPolicyEffectV1,
  b: RoomComposedPolicyEffectV1,
): RoomComposedPolicyEffectV1 {
  const ra = a in STRICTNESS ? effectStrictnessV1(a) : STRICTNESS.deny;
  const rb = b in STRICTNESS ? effectStrictnessV1(b) : STRICTNESS.deny;
  if (ra >= rb) return a in STRICTNESS ? a : "deny";
  return b in STRICTNESS ? b : "deny";
}

/** Fold a list of effects to the single strictest one (deny by default). */
export function foldStrictestEffectV1(
  effects: readonly RoomComposedPolicyEffectV1[],
): RoomComposedPolicyEffectV1 {
  let result: RoomComposedPolicyEffectV1 = "allow";
  for (const e of effects) result = strictestEffectV1(result, e);
  return result;
}
