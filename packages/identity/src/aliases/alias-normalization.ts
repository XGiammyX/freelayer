/**
 * Baseline alias text normalization (TECH-ID-05). Conservative and honest:
 * Unicode NFC + ordinary-whitespace trim + rejection of dangerous control /
 * bidi-override / bidi-isolate / selected zero-width / NUL code points, within
 * scalar + UTF-8 limits. It does NOT case-fold visible names, does NOT make
 * aliases globally unique, does NOT block whole writing systems, and is NOT a
 * UTS #39 confusable detector — normalization is NOT proof an alias is safe.
 *
 * ZWJ (U+200D) and ZWNJ (U+200C) are RETAINED: they are required for legitimate
 * languages (e.g. Persian, Devanagari) and emoji ZWJ sequences. Security-
 * sensitive UI must never rely on alias text alone.
 */

import { ContactAliasNormalizationError } from "./alias-errors";

export type ContactAliasDisplayText = string & {
  readonly __contactAliasDisplayText: unique symbol;
};

export interface ContactAliasTextV1 {
  readonly originalInputState: "discarded_after_validation";
  readonly normalizedValue: ContactAliasDisplayText;
  readonly normalization: "unicode_nfc";
  readonly scalarLength: number;
  readonly utf8ByteLength: number;
}

export const CONTACT_ALIAS_LIMITS_V1 = {
  minimumScalarLength: 1,
  maximumScalarLength: 64,
  maximumUtf8Bytes: 256,
  maximumActivePresentationAliasesPerRelationship: 1,
  maximumActiveLocalPeerLabelsPerRelationship: 1,
} as const;

// Exact code points rejected by the documented baseline policy. Bidi overrides
// (202A..202E) and isolates (2066..2069) are dangerous; U+200C/U+200D are NOT here.
const REJECTED_CODE_POINTS: ReadonlySet<number> = new Set([
  0x2028,
  0x2029, // line / paragraph separators
  0x200b, // zero-width space
  0x2060, // word joiner
  0xfeff, // zero-width no-break space / BOM
]);

function isRejectedCodePoint(cp: number): boolean {
  if (cp <= 0x1f) return true; // C0 controls (incl. NUL)
  if (cp >= 0x7f && cp <= 0x9f) return true; // DEL + C1 controls
  if (cp >= 0x202a && cp <= 0x202e) return true; // bidi overrides
  if (cp >= 0x2066 && cp <= 0x2069) return true; // bidi isolates
  return REJECTED_CODE_POINTS.has(cp);
}

const { minimumScalarLength, maximumScalarLength, maximumUtf8Bytes } = CONTACT_ALIAS_LIMITS_V1;
const utf8 = new TextEncoder();

/**
 * Normalize + validate alias display text. Returns ONLY normalized content
 * (raw input is discarded). Throws a content-free error on any violation.
 */
export function normalizeContactAliasDisplayTextV1(input: string): ContactAliasTextV1 {
  if (typeof input !== "string") throw new ContactAliasNormalizationError("not_a_string");
  const normalized = input.normalize("NFC").trim();
  if (normalized.length === 0) throw new ContactAliasNormalizationError("empty");

  let scalarLength = 0;
  for (const ch of normalized) {
    const cp = ch.codePointAt(0)!;
    if (isRejectedCodePoint(cp)) throw new ContactAliasNormalizationError("dangerous_code_point");
    scalarLength += 1;
  }
  if (scalarLength < minimumScalarLength || scalarLength > maximumScalarLength) {
    throw new ContactAliasNormalizationError("bad_scalar_length");
  }
  const utf8ByteLength = utf8.encode(normalized).length;
  if (utf8ByteLength > maximumUtf8Bytes) {
    throw new ContactAliasNormalizationError("bad_byte_length");
  }

  return {
    originalInputState: "discarded_after_validation",
    normalizedValue: normalized as ContactAliasDisplayText,
    normalization: "unicode_nfc",
    scalarLength,
    utf8ByteLength,
  };
}
