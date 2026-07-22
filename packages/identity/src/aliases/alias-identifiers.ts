/**
 * Opaque local alias identifiers (TECH-ID-05). These are LOCAL record references,
 * NOT visible names and NOT contact-discovery handles. They encode no display
 * text, no root/persona/relationship id, no phone/email/username, no timestamp,
 * no room id, no device info, and no key material. An id grants NO authority and
 * proves NO identity. Injected generation only (never randomness in a reducer).
 */

import { ContactAliasValidationError } from "./alias-errors";

export type ContactAliasId = string & { readonly __contactAliasId: unique symbol };
export type LocalPeerLabelId = string & { readonly __localPeerLabelId: unique symbol };

const ID_BODY_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;

function validateOpaque(input: unknown, prefix: string): string {
  if (typeof input !== "string" || input.length < 4 || input.length > 128) {
    throw new ContactAliasValidationError("bad_id_length");
  }
  if (!input.startsWith(`${prefix}-`) || !ID_BODY_RE.test(input) || input.includes("@")) {
    throw new ContactAliasValidationError("bad_id_format");
  }
  return input;
}

export function validateContactAliasId(input: string): ContactAliasId {
  return validateOpaque(input, "alias") as ContactAliasId;
}
export function validateLocalPeerLabelId(input: string): LocalPeerLabelId {
  return validateOpaque(input, "plabel") as LocalPeerLabelId;
}

/** Pre-generated ids passed INTO the reducer for create/rotate commands. */
export interface ContactAliasGeneratedIdsV1 {
  readonly aliasId?: ContactAliasId;
  readonly labelId?: LocalPeerLabelId;
}
