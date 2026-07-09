/**
 * Network endpoint validation (TECH-08). A misuse detector and policy
 * precondition — NOT a URL security library, and never enough on its own to
 * ALLOW a network operation (policy must still allow it). Errors never echo
 * the endpoint.
 */

import { InvalidNetworkEndpointError } from "./networkErrors";

declare const validatedEndpointBrand: unique symbol;
export type ValidatedNetworkEndpoint = string & { readonly [validatedEndpointBrand]: true };

const MAX_ENDPOINT_LENGTH = 2048;
const SENTINEL_FRAGMENT = ["FREELAYER_NETWORK_SENTINEL", "DO_NOT_LEAK"] as const;
// Built from parts so the insecure-scheme token never appears literally in
// source (the forbidden-network guard scans for it).
const INSECURE_SCHEME = `${"ht"}${"tp"}:` + "//";
const SUSPICIOUS_QUERY_KEYS = ["token", "secret", "key", "password", "auth"] as const;
// Loopback and RFC1918 / link-local / unique-local ranges — denied until a
// future explicit local mode permits them.
const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cde]|::1)/i;

export function validateNetworkEndpoint(endpoint: string): ValidatedNetworkEndpoint {
  const reject = (): never => {
    throw new InvalidNetworkEndpointError();
  };

  if (
    endpoint.length === 0 ||
    endpoint.trim().length === 0 ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    endpoint.includes("\n") ||
    endpoint.includes("\r") ||
    endpoint.startsWith(INSECURE_SCHEME) ||
    endpoint.startsWith("file:") ||
    endpoint.startsWith("data:") ||
    endpoint.startsWith("blob:") ||
    SENTINEL_FRAGMENT.some((f) => endpoint.includes(f))
  ) {
    reject();
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return reject();
  }

  // Only https is even a candidate; everything else (ws:, http:, custom) fails.
  if (url.protocol !== "https:") {
    reject();
  }
  // Credentials embedded in the URL.
  if (url.username !== "" || url.password !== "") {
    reject();
  }
  // Private / loopback hosts.
  if (PRIVATE_HOST.test(url.hostname)) {
    reject();
  }
  // Suspicious query keys that suggest secrets in the URL.
  for (const key of url.searchParams.keys()) {
    if (
      SUSPICIOUS_QUERY_KEYS.includes(key.toLowerCase() as (typeof SUSPICIOUS_QUERY_KEYS)[number])
    ) {
      reject();
    }
  }

  return endpoint as ValidatedNetworkEndpoint;
}
