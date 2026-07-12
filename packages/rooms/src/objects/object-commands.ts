/**
 * Explicit RoomOS object mutation commands (TECH-18).
 *
 * There is NO generic patch: no `object.patch`, `set_property`, `merge_payload`,
 * or JSON Patch. Every mutation is an operation-specific command with exact
 * expected fields. The validator rejects unknown commands, unsupported schema
 * versions, unexpected/authority fields, prototype-pollution keys, oversized
 * content, and path/URL/credential values in file refs. Accepted fields are
 * copied explicitly — unvalidated input is never spread into a domain object.
 */

import type { PrivacyMode } from "@freelayer/privacy";
import type { RoomLocalId, RoomMemberRef } from "../room-types";
import { validateRoomMemberRef } from "../room-types";
import { objectFail } from "./object-errors";
import {
  ROOM_OBJECT_SCHEMA_VERSION,
  validateRoomObjectId,
  validateRoomObjectRevision,
  type RoomObjectId,
  type RoomObjectRevision,
} from "./object-ids";
import { POLL_MIN_OPTIONS, ROOM_OBJECT_LIMITS_V1, TASK_MAX_ASSIGNEES } from "./object-limits";
import {
  ROOM_DECISION_STATUSES,
  ROOM_TASK_STATUSES,
  type RoomDecisionStatus,
  type RoomTaskStatus,
} from "./object-types";
import {
  assertNoDangerousKeys,
  assertOnlyKeys,
  isPlainRecord,
  utf8ByteLength,
  validateRoomPlainText,
  type RoomPlainTextV1,
} from "./object-validation";

export type RoomObjectCommandName =
  | "message.create"
  | "message.edit"
  | "message.redact"
  | "note.create"
  | "note.update_content"
  | "note.update_tags"
  | "task.create"
  | "task.update_content"
  | "task.update_status"
  | "decision.create"
  | "decision.resolve"
  | "poll.create"
  | "poll.update_draft"
  | "poll.open_placeholder"
  | "poll.close_placeholder"
  | "file_ref.create_placeholder"
  | "file_ref.update_metadata"
  | "object.archive"
  | "object.redact"
  | "object.tombstone";

export interface RoomObjectMutationBaseV1 {
  readonly schemaVersion: 1;
  readonly roomId: RoomLocalId;
  readonly objectId: RoomObjectId;
  readonly actorRef: RoomMemberRef | "local_unknown";
  readonly expectedRevision?: RoomObjectRevision;
  readonly mode: PrivacyMode;
  /** Non-sensitive justification code. Never content/title/name. */
  readonly reason: string;
}

export interface CreateMessageCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "message.create";
  readonly expectedRevision?: never;
  readonly body: RoomPlainTextV1;
  readonly replyToObjectId?: RoomObjectId;
}
export interface EditMessageCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "message.edit";
  readonly expectedRevision: RoomObjectRevision;
  readonly body: RoomPlainTextV1;
}
export interface RedactMessageCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "message.redact";
  readonly expectedRevision: RoomObjectRevision;
}
export interface CreateNoteCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "note.create";
  readonly expectedRevision?: never;
  readonly title?: RoomPlainTextV1;
  readonly body: RoomPlainTextV1;
  readonly tags: readonly string[];
}
export interface UpdateNoteContentCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "note.update_content";
  readonly expectedRevision: RoomObjectRevision;
  readonly title?: RoomPlainTextV1;
  readonly body: RoomPlainTextV1;
}
export interface UpdateNoteTagsCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "note.update_tags";
  readonly expectedRevision: RoomObjectRevision;
  readonly tags: readonly string[];
}
export interface CreateTaskCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "task.create";
  readonly expectedRevision?: never;
  readonly title: RoomPlainTextV1;
  readonly description?: RoomPlainTextV1;
  readonly assigneeRefs: readonly RoomMemberRef[];
  readonly dueAtLocal?: string;
  readonly tags: readonly string[];
}
export interface UpdateTaskContentCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "task.update_content";
  readonly expectedRevision: RoomObjectRevision;
  readonly title: RoomPlainTextV1;
  readonly description?: RoomPlainTextV1;
  readonly assigneeRefs: readonly RoomMemberRef[];
  readonly dueAtLocal?: string;
  readonly tags: readonly string[];
}
export interface UpdateTaskStatusCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "task.update_status";
  readonly expectedRevision: RoomObjectRevision;
  readonly status: RoomTaskStatus;
}
export interface CreateDecisionCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "decision.create";
  readonly expectedRevision?: never;
  readonly statement: RoomPlainTextV1;
  readonly rationale?: RoomPlainTextV1;
}
export interface ResolveDecisionCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "decision.resolve";
  readonly expectedRevision: RoomObjectRevision;
  /** proposed→ target; also carries draft edits while still proposed. */
  readonly status: RoomDecisionStatus;
  readonly statement?: RoomPlainTextV1;
  readonly rationale?: RoomPlainTextV1;
  readonly supersedesObjectId?: RoomObjectId;
}
export interface CreatePollCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "poll.create";
  readonly expectedRevision?: never;
  readonly question: RoomPlainTextV1;
  readonly options: readonly { readonly optionId: string; readonly label: RoomPlainTextV1 }[];
}
export interface UpdatePollDraftCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "poll.update_draft";
  readonly expectedRevision: RoomObjectRevision;
  readonly question: RoomPlainTextV1;
  readonly options: readonly { readonly optionId: string; readonly label: RoomPlainTextV1 }[];
}
export interface OpenPollPlaceholderCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "poll.open_placeholder";
  readonly expectedRevision: RoomObjectRevision;
}
export interface ClosePollPlaceholderCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "poll.close_placeholder";
  readonly expectedRevision: RoomObjectRevision;
}
export interface CreateFileRefPlaceholderCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "file_ref.create_placeholder";
  readonly expectedRevision?: never;
  readonly localRefId: string;
  readonly displayName?: RoomPlainTextV1;
  readonly mediaType?: string;
  readonly sizeBytes?: number;
}
export interface UpdateFileRefMetadataCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "file_ref.update_metadata";
  readonly expectedRevision: RoomObjectRevision;
  readonly displayName?: RoomPlainTextV1;
  readonly mediaType?: string;
  readonly sizeBytes?: number;
}
export interface ArchiveRoomObjectCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "object.archive";
  readonly expectedRevision: RoomObjectRevision;
}
export interface RedactRoomObjectCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "object.redact";
  readonly expectedRevision: RoomObjectRevision;
}
export interface TombstoneRoomObjectCommandV1 extends RoomObjectMutationBaseV1 {
  readonly command: "object.tombstone";
  readonly expectedRevision: RoomObjectRevision;
}

export type RoomObjectMutationCommandV1 =
  | CreateMessageCommandV1
  | EditMessageCommandV1
  | RedactMessageCommandV1
  | CreateNoteCommandV1
  | UpdateNoteContentCommandV1
  | UpdateNoteTagsCommandV1
  | CreateTaskCommandV1
  | UpdateTaskContentCommandV1
  | UpdateTaskStatusCommandV1
  | CreateDecisionCommandV1
  | ResolveDecisionCommandV1
  | CreatePollCommandV1
  | UpdatePollDraftCommandV1
  | OpenPollPlaceholderCommandV1
  | ClosePollPlaceholderCommandV1
  | CreateFileRefPlaceholderCommandV1
  | UpdateFileRefMetadataCommandV1
  | ArchiveRoomObjectCommandV1
  | RedactRoomObjectCommandV1
  | TombstoneRoomObjectCommandV1;

export const ROOM_OBJECT_COMMAND_NAMES: readonly RoomObjectCommandName[] = [
  "message.create",
  "message.edit",
  "message.redact",
  "note.create",
  "note.update_content",
  "note.update_tags",
  "task.create",
  "task.update_content",
  "task.update_status",
  "decision.create",
  "decision.resolve",
  "poll.create",
  "poll.update_draft",
  "poll.open_placeholder",
  "poll.close_placeholder",
  "file_ref.create_placeholder",
  "file_ref.update_metadata",
  "object.archive",
  "object.redact",
  "object.tombstone",
];

const REASON_RE = /^[a-z0-9_.:-]{1,64}$/;
const LOCAL_REF_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/;
const MEDIA_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const TAG_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/i;

/** Reject any path/URL/credential-bearing string (file refs hold none). */
function assertNoForbiddenReference(value: string): void {
  const lower = value.toLowerCase();
  if (
    value.includes("://") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.includes("@") ||
    /^[a-z]:/i.test(value) || // drive letter
    lower.startsWith("http:") ||
    lower.startsWith("https:") ||
    lower.startsWith("file:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("data:")
  ) {
    objectFail("forbidden_reference");
  }
}

function validateTags(input: unknown): readonly string[] {
  if (!Array.isArray(input)) objectFail("invalid_field");
  if (input.length > ROOM_OBJECT_LIMITS_V1.tagCount) objectFail("too_many_tags");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string" || !TAG_RE.test(raw)) objectFail("invalid_field");
    if (utf8ByteLength(raw) > ROOM_OBJECT_LIMITS_V1.tagBytes) objectFail("tag_too_large");
    // Deterministic de-duplication (documented policy): drop later duplicates.
    if (!seen.has(raw)) {
      seen.add(raw);
      out.push(raw);
    }
  }
  return Object.freeze(out);
}

function validateAssignees(input: unknown): readonly RoomMemberRef[] {
  if (!Array.isArray(input)) objectFail("invalid_field");
  if (input.length > TASK_MAX_ASSIGNEES) objectFail("too_many_tags");
  const seen = new Set<string>();
  const out: RoomMemberRef[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") objectFail("invalid_actor_ref");
    let ref: RoomMemberRef;
    try {
      ref = validateRoomMemberRef(raw);
    } catch {
      objectFail("invalid_actor_ref");
    }
    if (!seen.has(ref)) {
      seen.add(ref);
      out.push(ref);
    }
  }
  return Object.freeze(out);
}

function validateOptions(
  input: unknown,
): readonly { readonly optionId: string; readonly label: RoomPlainTextV1 }[] {
  if (!Array.isArray(input)) objectFail("invalid_field");
  if (input.length < POLL_MIN_OPTIONS) objectFail("too_few_options");
  if (input.length > ROOM_OBJECT_LIMITS_V1.pollOptionCount) objectFail("too_many_options");
  const ids = new Set<string>();
  const out: { readonly optionId: string; readonly label: RoomPlainTextV1 }[] = [];
  for (const raw of input) {
    if (!isPlainRecord(raw)) objectFail("invalid_field");
    assertNoDangerousKeys(raw);
    assertOnlyKeys(raw, ["optionId", "label"]);
    if (typeof raw["optionId"] !== "string" || !LOCAL_REF_RE.test(raw["optionId"])) {
      objectFail("invalid_field");
    }
    if (ids.has(raw["optionId"])) objectFail("duplicate_option_id");
    ids.add(raw["optionId"]);
    const label = validateRoomPlainText(
      raw["label"],
      ROOM_OBJECT_LIMITS_V1.pollOptionLabelBytes,
      "poll_option",
    );
    out.push({ optionId: raw["optionId"], label });
  }
  return Object.freeze(out);
}

function validateMediaType(input: unknown): string {
  if (typeof input !== "string") objectFail("invalid_field");
  if (utf8ByteLength(input) > ROOM_OBJECT_LIMITS_V1.mediaTypeBytes || !MEDIA_TYPE_RE.test(input)) {
    objectFail("invalid_field");
  }
  assertNoForbiddenReference(input);
  return input;
}

function validateSizeBytes(input: unknown): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) {
    objectFail("invalid_field");
  }
  return input as number;
}

function validateDueLocal(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("local:") || input.length > 64) {
    objectFail("invalid_field");
  }
  return input as string;
}

/**
 * Validate + normalize an untrusted mutation command. Returns a fresh command
 * built ONLY from explicitly-extracted, validated fields (no input spread).
 */
export function validateRoomObjectMutationCommandV1(input: unknown): RoomObjectMutationCommandV1 {
  if (!isPlainRecord(input)) objectFail("invalid_field");
  assertNoDangerousKeys(input);
  if (input["schemaVersion"] !== ROOM_OBJECT_SCHEMA_VERSION) {
    objectFail("unsupported_schema_version");
  }
  const command = input["command"];
  if (typeof command !== "string" || !ROOM_OBJECT_COMMAND_NAMES.includes(command as never)) {
    objectFail("unknown_command");
  }
  if (typeof input["roomId"] !== "string") objectFail("invalid_room_id");
  const roomId = input["roomId"] as RoomLocalId;
  const objectId = validateRoomObjectId(input["objectId"] as string);
  const actorRef = validateActor(input["actorRef"]);
  if (typeof input["mode"] !== "string") objectFail("invalid_field");
  const mode = input["mode"] as PrivacyMode;
  if (typeof input["reason"] !== "string" || !REASON_RE.test(input["reason"])) {
    objectFail("invalid_field");
  }
  const reason = input["reason"];

  const base = { schemaVersion: 1 as const, roomId, objectId, actorRef, mode, reason };
  const isCreate = command.endsWith(".create") || command === "file_ref.create_placeholder";
  const expectedRevision = isCreate
    ? assertNoExpectedRevision(input)
    : requireExpectedRevision(input);

  return buildCommand(command as RoomObjectCommandName, input, base, expectedRevision);
}

function validateActor(actor: unknown): RoomMemberRef | "local_unknown" {
  if (actor === "local_unknown") return "local_unknown";
  if (typeof actor !== "string") objectFail("invalid_actor_ref");
  try {
    return validateRoomMemberRef(actor as string);
  } catch {
    objectFail("invalid_actor_ref");
  }
}

function assertNoExpectedRevision(input: Record<string, unknown>): undefined {
  if (input["expectedRevision"] !== undefined) objectFail("unexpected_field");
  return undefined;
}

function requireExpectedRevision(input: Record<string, unknown>): RoomObjectRevision {
  if (input["expectedRevision"] === undefined) objectFail("missing_expected_revision");
  return validateRoomObjectRevision(input["expectedRevision"] as number);
}

function optionalText(
  input: Record<string, unknown>,
  key: string,
  limit: number,
): RoomPlainTextV1 | undefined {
  return input[key] === undefined ? undefined : validateRoomPlainText(input[key], limit, key);
}

const L = ROOM_OBJECT_LIMITS_V1;

function buildCommand(
  command: RoomObjectCommandName,
  input: Record<string, unknown>,
  base: Omit<RoomObjectMutationBaseV1, "expectedRevision">,
  rev: RoomObjectRevision | undefined,
): RoomObjectMutationCommandV1 {
  switch (command) {
    case "message.create":
      assertOnlyKeys(input, [...BASE_KEYS, "body", "replyToObjectId"]);
      return {
        ...base,
        command,
        body: validateRoomPlainText(input["body"], L.messageBodyBytes, "message_body"),
        ...(input["replyToObjectId"] !== undefined
          ? { replyToObjectId: validateRoomObjectId(input["replyToObjectId"] as string) }
          : {}),
      };
    case "message.edit":
      assertOnlyKeys(input, [...BASE_KEYS, "expectedRevision", "body"]);
      return {
        ...base,
        command,
        expectedRevision: rev!,
        body: validateRoomPlainText(input["body"], L.messageBodyBytes, "message_body"),
      };
    case "note.create":
      assertOnlyKeys(input, [...BASE_KEYS, "title", "body", "tags"]);
      return {
        ...base,
        command,
        ...(optionalText(input, "title", L.noteTitleBytes) !== undefined
          ? { title: optionalText(input, "title", L.noteTitleBytes)! }
          : {}),
        body: validateRoomPlainText(input["body"], L.noteBodyBytes, "note_body"),
        tags: validateTags(input["tags"]),
      };
    case "note.update_content":
      assertOnlyKeys(input, [...BASE_KEYS, "expectedRevision", "title", "body"]);
      return {
        ...base,
        command,
        expectedRevision: rev!,
        ...(optionalText(input, "title", L.noteTitleBytes) !== undefined
          ? { title: optionalText(input, "title", L.noteTitleBytes)! }
          : {}),
        body: validateRoomPlainText(input["body"], L.noteBodyBytes, "note_body"),
      };
    case "note.update_tags":
      assertOnlyKeys(input, [...BASE_KEYS, "expectedRevision", "tags"]);
      return { ...base, command, expectedRevision: rev!, tags: validateTags(input["tags"]) };
    case "task.create":
      assertOnlyKeys(input, [
        ...BASE_KEYS,
        "title",
        "description",
        "assigneeRefs",
        "dueAtLocal",
        "tags",
      ]);
      return {
        ...base,
        command,
        title: validateRoomPlainText(input["title"], L.taskTitleBytes, "task_title"),
        ...(optionalText(input, "description", L.taskDescriptionBytes) !== undefined
          ? { description: optionalText(input, "description", L.taskDescriptionBytes)! }
          : {}),
        assigneeRefs: validateAssignees(input["assigneeRefs"]),
        ...(input["dueAtLocal"] !== undefined
          ? { dueAtLocal: validateDueLocal(input["dueAtLocal"]) }
          : {}),
        tags: validateTags(input["tags"]),
      };
    case "task.update_content":
      assertOnlyKeys(input, [
        ...BASE_KEYS,
        "expectedRevision",
        "title",
        "description",
        "assigneeRefs",
        "dueAtLocal",
        "tags",
      ]);
      return {
        ...base,
        command,
        expectedRevision: rev!,
        title: validateRoomPlainText(input["title"], L.taskTitleBytes, "task_title"),
        ...(optionalText(input, "description", L.taskDescriptionBytes) !== undefined
          ? { description: optionalText(input, "description", L.taskDescriptionBytes)! }
          : {}),
        assigneeRefs: validateAssignees(input["assigneeRefs"]),
        ...(input["dueAtLocal"] !== undefined
          ? { dueAtLocal: validateDueLocal(input["dueAtLocal"]) }
          : {}),
        tags: validateTags(input["tags"]),
      };
    case "task.update_status":
      assertOnlyKeys(input, [...BASE_KEYS, "expectedRevision", "status"]);
      if (!ROOM_TASK_STATUSES.includes(input["status"] as RoomTaskStatus))
        objectFail("invalid_field");
      return {
        ...base,
        command,
        expectedRevision: rev!,
        status: input["status"] as RoomTaskStatus,
      };
    case "decision.create":
      assertOnlyKeys(input, [...BASE_KEYS, "statement", "rationale"]);
      return {
        ...base,
        command,
        statement: validateRoomPlainText(
          input["statement"],
          L.decisionStatementBytes,
          "decision_statement",
        ),
        ...(optionalText(input, "rationale", L.decisionRationaleBytes) !== undefined
          ? { rationale: optionalText(input, "rationale", L.decisionRationaleBytes)! }
          : {}),
      };
    case "decision.resolve":
      assertOnlyKeys(input, [
        ...BASE_KEYS,
        "expectedRevision",
        "status",
        "statement",
        "rationale",
        "supersedesObjectId",
      ]);
      if (!ROOM_DECISION_STATUSES.includes(input["status"] as RoomDecisionStatus))
        objectFail("invalid_field");
      return {
        ...base,
        command,
        expectedRevision: rev!,
        status: input["status"] as RoomDecisionStatus,
        ...(optionalText(input, "statement", L.decisionStatementBytes) !== undefined
          ? { statement: optionalText(input, "statement", L.decisionStatementBytes)! }
          : {}),
        ...(optionalText(input, "rationale", L.decisionRationaleBytes) !== undefined
          ? { rationale: optionalText(input, "rationale", L.decisionRationaleBytes)! }
          : {}),
        ...(input["supersedesObjectId"] !== undefined
          ? { supersedesObjectId: validateRoomObjectId(input["supersedesObjectId"] as string) }
          : {}),
      };
    case "poll.create":
      assertOnlyKeys(input, [...BASE_KEYS, "question", "options"]);
      return {
        ...base,
        command,
        question: validateRoomPlainText(input["question"], L.pollQuestionBytes, "poll_question"),
        options: validateOptions(input["options"]),
      };
    case "poll.update_draft":
      assertOnlyKeys(input, [...BASE_KEYS, "expectedRevision", "question", "options"]);
      return {
        ...base,
        command,
        expectedRevision: rev!,
        question: validateRoomPlainText(input["question"], L.pollQuestionBytes, "poll_question"),
        options: validateOptions(input["options"]),
      };
    case "message.redact":
    case "poll.open_placeholder":
    case "poll.close_placeholder":
    case "object.archive":
    case "object.redact":
    case "object.tombstone":
      assertOnlyKeys(input, [...BASE_KEYS, "expectedRevision"]);
      return { ...base, command, expectedRevision: rev! };
    case "file_ref.create_placeholder": {
      assertOnlyKeys(input, [...BASE_KEYS, "localRefId", "displayName", "mediaType", "sizeBytes"]);
      if (typeof input["localRefId"] !== "string" || !LOCAL_REF_RE.test(input["localRefId"])) {
        objectFail("invalid_field");
      }
      assertNoForbiddenReference(input["localRefId"]);
      return {
        ...base,
        command,
        localRefId: input["localRefId"],
        ...fileMeta(input),
      };
    }
    case "file_ref.update_metadata":
      assertOnlyKeys(input, [
        ...BASE_KEYS,
        "expectedRevision",
        "displayName",
        "mediaType",
        "sizeBytes",
      ]);
      return { ...base, command, expectedRevision: rev!, ...fileMeta(input) };
    default: {
      const unreachable: never = command;
      objectFail("unknown_command", String(unreachable));
    }
  }
}

function fileMeta(input: Record<string, unknown>): {
  displayName?: RoomPlainTextV1;
  mediaType?: string;
  sizeBytes?: number;
} {
  const out: { displayName?: RoomPlainTextV1; mediaType?: string; sizeBytes?: number } = {};
  if (input["displayName"] !== undefined) {
    const name = validateRoomPlainText(input["displayName"], L.fileDisplayNameBytes, "file_name");
    assertNoForbiddenReference(name.value);
    out.displayName = name;
  }
  if (input["mediaType"] !== undefined) out.mediaType = validateMediaType(input["mediaType"]);
  if (input["sizeBytes"] !== undefined) out.sizeBytes = validateSizeBytes(input["sizeBytes"]);
  return out;
}

const BASE_KEYS = [
  "schemaVersion",
  "command",
  "roomId",
  "objectId",
  "actorRef",
  "mode",
  "reason",
] as const;
