/**
 * Plain-text value + shared safe-field helpers (TECH-18).
 *
 * Content is PLAIN TEXT ONLY: no HTML mode, no rendered Markdown, no embedded
 * remote resources, no object coercion, no custom `toString` invocation. We
 * reject NUL and unpaired surrogates, preserve legitimate Unicode, and count
 * UTF-8 bytes deterministically. Errors are generic — content is never echoed.
 */

import { objectFail } from "./object-errors";

export interface RoomPlainTextV1 {
  readonly format: "plain_text";
  readonly value: string;
}

// Lone (unpaired) surrogate detection: a high surrogate not followed by a low,
// or a low surrogate not preceded by a high.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** True if the string contains a NUL (U+0000). */
function hasNul(value: string): boolean {
  return value.indexOf(String.fromCharCode(0)) !== -1;
}

/** Deterministic UTF-8 byte length of a string (no allocation of a Buffer). */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: a valid pair encodes to 4 bytes.
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Validate a plain-text field. `input` must be a bare string OR a
 * `{ format: "plain_text", value }` record — never an arbitrary object whose
 * getters could execute. `limitBytes` is a UTF-8 ceiling; `fieldCode` is a
 * STATIC code used only for error classification (never content).
 */
export function validateRoomPlainText(
  input: unknown,
  limitBytes: number,
  _fieldCode: string,
): RoomPlainTextV1 {
  let value: unknown;
  if (typeof input === "string") {
    value = input;
  } else if (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    // Exact-shape check: only the two expected own keys, no accessors trusted.
    Object.keys(input).every((k) => k === "format" || k === "value") &&
    (input as { format?: unknown }).format === "plain_text"
  ) {
    value = (input as { value?: unknown }).value;
  } else {
    objectFail("invalid_plain_text");
  }
  if (typeof value !== "string") {
    objectFail("invalid_plain_text");
  }
  const str = value as string;
  if (hasNul(str) || LONE_SURROGATE.test(str)) {
    objectFail("invalid_plain_text");
  }
  if (utf8ByteLength(str) > limitBytes) {
    objectFail("content_too_large");
  }
  return { format: "plain_text", value: str };
}

/** True only for a plain non-null, non-array object (no getters trusted). */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DANGEROUS_KEYS = ["__proto__", "prototype", "constructor"] as const;

/** Reject prototype-pollution keys anywhere in the top level of a record. */
export function assertNoDangerousKeys(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if ((DANGEROUS_KEYS as readonly string[]).includes(key)) {
      objectFail("dangerous_key");
    }
  }
}

/** Reject any own key not in the allowed set (no mass assignment). */
export function assertOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      objectFail("unexpected_field");
    }
  }
}
