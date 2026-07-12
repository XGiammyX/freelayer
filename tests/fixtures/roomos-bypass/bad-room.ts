// FIXTURE (never compiled/run — not in tests/tsconfig include). Every line is a
// RoomOS bypass the guardrail must catch.
/* eslint-disable */
declare const roomState: any;
declare const room: any;
declare const event: any;
roomState.objects.push({ id: "x" });
roomState.members.push({ ref: "y" });
console.log(roomState, room);
console.log(event);
const overclaim = { endpointDefenseActive: true, screenShieldActive: true };
// @ts-ignore
import * as Y from "yjs";
// @ts-ignore
import { next } from "@automerge/automerge";
