// FIXTURE (not shipped): representative RoomOS query violations the
// check:no-room-query-bypass guardrail must catch. Never imported by the app.
/* eslint-disable */
// @ts-nocheck

export function bad(roomState, term, query, result, cursor) {
  // Raw projection traversal outside the query package.
  const hit = roomState.objects.find((o) => o.objectId === "x");
  const list = roomState.objects.filter((o) => o.kind === "message");
  // Query history / result cache / persistent index.
  queryHistory.push(term);
  resultCache.set(term, result);
  buildSearchIndex(roomState.objects);
  // Dynamic RegExp from query input.
  const re = new RegExp(term);
  // Query/result serialization + term logging.
  console.log(JSON.stringify(query));
  console.log(JSON.stringify(result));
  console.log(query);
  // Persistence / network / rendering / file.
  localStorage.setItem("q", term);
  fetch("https://example.com/search?q=" + term);
  el.innerHTML = result;
  const bytes = readFileSync("/etc/passwd");
  // Endpoint overclaim.
  const flags = { captureProtected: true, screenShieldActive: true };
  return { hit, list, re, bytes, flags };
}

// FTS + AI imports.
import Fuse from "fuse.js";
import lunr from "lunr";
import { infer } from "@freelayer/ai";
