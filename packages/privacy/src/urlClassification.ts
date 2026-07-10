/**
 * URL classification + safe display (TECH-11). PURE — no network, no DNS, no
 * fetch. Classifies a string so link/asset policy can decide, and produces a
 * display label that never leaks credentials or query strings
 * (docs/METADATA_MODEL.md — URLs are content-adjacent metadata).
 */

export type UrlClassification =
  | "not_a_url"
  | "relative_url"
  | "local_fragment"
  | "mailto"
  | "tel"
  | "http_url"
  | "https_url"
  | "websocket_url"
  | "data_url"
  | "blob_url"
  | "file_url"
  | "javascript_url"
  | "unknown_scheme"
  | "invalid";

export interface ClassifiedUrl {
  readonly classification: UrlClassification;
  /** Redacted, length-capped label safe to render. Never contains query/credentials. */
  readonly safeDisplayText: string;
  /** True if the scheme can open a network channel (http/https/ws/wss). */
  readonly networkCapable: boolean;
  /** True if it points outside the app (network/mailto/tel/unknown scheme). */
  readonly external: boolean;
}

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const MAX_LABEL = 48;

/** Control characters (NUL/newlines/tabs/DEL) make a URL suspicious/invalid. */
function hasControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function truncate(text: string): string {
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL)}…` : text;
}

function build(
  classification: UrlClassification,
  safeDisplayText: string,
  networkCapable: boolean,
  external: boolean,
): ClassifiedUrl {
  return { classification, safeDisplayText: truncate(safeDisplayText), networkCapable, external };
}

/**
 * Reduce an http(s)/ws(s) URL to `host` or `host/…` — dropping any userinfo
 * (credentials), port, path detail, query, and fragment. The bare domain is
 * the most we ever display; everything after it is redacted.
 */
function redactAuthority(raw: string): string {
  const afterScheme = raw.replace(SCHEME_RE, "").replace(/^\/\//, "");
  const authorityEnd = afterScheme.search(/[/?#\\]/);
  let authority = authorityEnd === -1 ? afterScheme : afterScheme.slice(0, authorityEnd);
  const rest = authorityEnd === -1 ? "" : afterScheme.slice(authorityEnd);
  // Drop userinfo (user:pass@host).
  const at = authority.lastIndexOf("@");
  if (at !== -1) {
    authority = authority.slice(at + 1);
  }
  // Host without port.
  const host = authority.split(":")[0] ?? "";
  const hasMore = rest.length > 0 && rest !== "/";
  if (host === "") {
    return "[redacted link]";
  }
  return hasMore ? `${host}/…` : host;
}

export function classifyUrl(input: unknown): ClassifiedUrl {
  const raw = typeof input === "string" ? input.trim() : "";
  if (raw === "") {
    return build("not_a_url", "", false, false);
  }
  if (hasControlChars(raw)) {
    return build("invalid", "[invalid link]", false, false);
  }
  if (raw.startsWith("#")) {
    return build("local_fragment", raw.slice(0, MAX_LABEL), false, false);
  }
  // Protocol-relative (//host/...) is external and network-capable.
  if (raw.startsWith("//")) {
    return build("https_url", redactAuthority(`https:${raw}`), true, true);
  }

  const schemeMatch = SCHEME_RE.exec(raw);
  if (schemeMatch === null) {
    // No scheme: a relative path/anchor (local) or a bare token (not a URL).
    if (
      raw.startsWith("/") ||
      raw.startsWith("./") ||
      raw.startsWith("../") ||
      raw.startsWith("?")
    ) {
      return build("relative_url", raw.split(/[?#]/)[0] ?? raw, false, false);
    }
    return build("not_a_url", "", false, false);
  }

  const scheme = (schemeMatch[1] ?? "").toLowerCase();
  switch (scheme) {
    case "http":
      return build("http_url", redactAuthority(raw), true, true);
    case "https":
      return build("https_url", redactAuthority(raw), true, true);
    case "ws":
    case "wss":
      return build("websocket_url", "[redacted link]", true, true);
    case "data":
      return build("data_url", "[data: URL]", false, true);
    case "blob":
      return build("blob_url", "[blob: URL]", false, true);
    case "file":
      return build("file_url", "[file: URL]", false, true);
    case "javascript":
      return build("javascript_url", "[blocked script URL]", false, true);
    case "mailto":
      return build("mailto", mailtoLabel(raw.slice(schemeMatch[0].length)), false, true);
    case "tel":
      return build("tel", "[tel: link]", false, true);
    default:
      return build("unknown_scheme", "[external link]", false, true);
  }
}

function mailtoLabel(rest: string): string {
  const address = rest.split(/[?#]/)[0] ?? "";
  const at = address.lastIndexOf("@");
  return at !== -1 ? `mailto:…@${address.slice(at + 1)}` : "[email link]";
}

export interface PlainTextUrlLabelOptions {
  /** When true (e.g. ScreenShield sealed), collapse to a fully generic label. */
  readonly forceRedactAll?: boolean;
}

/**
 * The ONLY sanctioned way to render a URL as text. Never fetches, never embeds
 * an image/favicon, never builds a preview card. Returns a redacted label.
 */
export function renderPlainTextUrlLabel(
  input: unknown,
  options?: PlainTextUrlLabelOptions,
): string {
  if (options?.forceRedactAll === true) {
    return "[redacted link]";
  }
  const classified = classifyUrl(input);
  if (classified.classification === "javascript_url") {
    return "[blocked script URL]";
  }
  return classified.safeDisplayText === "" ? "[link]" : classified.safeDisplayText;
}
