/**
 * Privacy-regression (TECH-ID-05 S31): Unicode handling matrix for per-contact
 * alias display text. Proves the ONE normalization we perform (Unicode NFC +
 * dangerous-control rejection) and, just as importantly, the transforms we do
 * NOT perform: no case folding, no transliteration, no script-wide blocking, no
 * confusable "safety" claim. Dangerous formatting/control code points are the
 * only rejections. Every non-ASCII code point is written as a \u escape, so no
 * invisible/bidi/control character lives literally in this source file.
 */
import { describe, expect, it } from "vitest";
import { normalizeContactAliasDisplayTextV1 } from "@freelayer/identity";

describe("NFC equivalence - decomposed input converges to precomposed", () => {
  // label, DECOMPOSED input, expected NFC precomposed value, expected scalars
  const cases: ReadonlyArray<readonly [string, string, string, number]> = [
    ["e + combining acute", "e\u0301", "\u00e9", 1],
    ["a + combining ring", "a\u030a", "\u00e5", 1],
    ["o + combining diaeresis", "o\u0308", "\u00f6", 1],
    ["Greek alpha + tonos", "\u03b1\u0301", "\u03ac", 1],
    ["already-precomposed e-acute", "\u00e9", "\u00e9", 1],
  ];
  it.each(cases)("%s -> NFC precomposed", (_label, input, expected, scalars) => {
    const n = normalizeContactAliasDisplayTextV1(input);
    expect(n.normalization).toBe("unicode_nfc");
    expect(n.normalizedValue).toBe(expected);
    expect(n.scalarLength).toBe(scalars);
    expect(n.normalizedValue).toBe(normalizeContactAliasDisplayTextV1(expected).normalizedValue);
  });
});

describe("No case folding, no transliteration, no script-wide blocking", () => {
  const accepted: ReadonlyArray<readonly [string, string]> = [
    ["ASCII mixed case", "Alice Smith"],
    ["Uppercase kept as-is", "BLUE FOX"],
    ["Latin-1 accents", "Cr\u00e8me Br\u00fbl\u00e9e"],
    ["Greek", "\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac"],
    ["Cyrillic", "\u041f\u0440\u0438\u0432\u0435\u0442"],
    ["Arabic", "\u0645\u0631\u062d\u0628\u0627"],
    ["Hebrew", "\u05e9\u05dc\u05d5\u05dd"],
    ["Devanagari", "\u0928\u092e\u0938\u094d\u0924\u0947"],
    ["CJK", "\u4f60\u597d\u4e16\u754c"],
    ["Hiragana", "\u3053\u3093\u306b\u3061\u306f"],
    ["Emoji (no ZWJ)", "\u{1f98a}\u{1f43e}"],
    ["ZWJ family emoji", "\u{1f469}\u200d\u{1f467}"],
    ["ZWNJ Persian", "\u067e\u200c\u06cc"],
  ];
  it.each(accepted)("accepts %s without altering script/case", (_label, input) => {
    const n = normalizeContactAliasDisplayTextV1(input);
    expect(n.scalarLength).toBeGreaterThan(0);
    // No transliteration: stored value stays code-point-equal to NFC(input).
    expect(n.normalizedValue).toBe(input.normalize("NFC").trim());
    // No case fold: an all-uppercase, case-bearing input keeps its case.
    if (input === input.toUpperCase() && input !== input.toLowerCase()) {
      expect(n.normalizedValue).toBe(n.normalizedValue.toUpperCase());
    }
  });
});

describe("Dangerous formatting / control code points are rejected", () => {
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ["NUL (C0)", "a\u0000b"],
    ["SOH (C0)", "a\u0001b"],
    ["DEL", "a\u007fb"],
    ["C1 control", "a\u0080b"],
    ["RLO bidi override", "a\u202eb"],
    ["LRO bidi override", "a\u202db"],
    ["LRI bidi isolate", "a\u2066b"],
    ["PDI bidi isolate", "a\u2069b"],
    ["zero-width space", "a\u200bb"],
    ["word joiner", "a\u2060b"],
    ["BOM / ZWNBSP", "a\ufeffb"],
    ["line separator", "a\u2028b"],
    ["paragraph separator", "a\u2029b"],
    ["empty", ""],
    ["whitespace only", "   "],
  ];
  it.each(rejected)("rejects %s", (_label, input) => {
    expect(() => normalizeContactAliasDisplayTextV1(input)).toThrow();
  });
});

describe("ZWJ / ZWNJ are retained (legitimate for many scripts + emoji)", () => {
  it("keeps U+200D and U+200C inside otherwise-valid text", () => {
    expect(
      normalizeContactAliasDisplayTextV1("\u{1f469}\u200d\u{1f4bb}").utf8ByteLength,
    ).toBeGreaterThan(0);
    expect(normalizeContactAliasDisplayTextV1("\u067e\u200c\u06cc").utf8ByteLength).toBeGreaterThan(
      0,
    );
  });
});

describe("No confusable 'safety' claim is made", () => {
  it("normalization result never asserts spoof-safety and discards raw input", () => {
    // Cyrillic 'a' (U+0430) beside Latin letters - a classic confusable. We do
    // NOT block it, and we do NOT claim it is safe.
    const n = normalizeContactAliasDisplayTextV1("\u0430lice");
    expect(n.scalarLength).toBeGreaterThan(0);
    expect(n.originalInputState).toBe("discarded_after_validation");
    const asJson = JSON.stringify(n).toLowerCase();
    expect(asJson).not.toContain("spoofproof");
    expect(asJson).not.toContain("confusablesafe");
    expect(asJson).not.toContain("verified");
  });
});
