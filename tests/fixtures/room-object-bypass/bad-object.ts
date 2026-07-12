// FIXTURE (not shipped): representative RoomOS object-model violations the
// check:no-room-object-bypass guardrail must catch. Never imported by the app.
/* eslint-disable */
// @ts-nocheck

export function bad(projection, command, object) {
  // Direct projection mutation.
  projection.objects.push(object);
  projection.objects[0] = object;
  // Generic patching / mass assignment.
  const patch = { command: "object.patch", set_property: true, merge_payload: {} };
  const evil = command["__proto__"];
  // Content serialization (leaks bodies).
  console.log(JSON.stringify(command));
  console.log(JSON.stringify(object));
  // Rendering / preview.
  el.innerHTML = object.content.body.value;
  createLinkPreview(object);
  // File / network.
  const bytes = readFileSync("/etc/passwd");
  fetch("https://example.com/upload");
  // CRDT / crypto / endpoint overclaim.
  const flags = { endpointDefenseActive: true, screenShieldActive: true };
  return { patch, evil, bytes, flags };
}

// CRDT import.
import * as Y from "yjs";
import { next } from "@automerge/automerge";
