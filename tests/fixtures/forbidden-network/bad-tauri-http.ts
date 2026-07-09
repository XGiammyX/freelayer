// FIXTURE — intentionally imports the Tauri HTTP plugin (forbidden until a
// future approved transport). Scanned only when passed explicitly.
// @ts-expect-error fixture: module intentionally not installed
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const useTauriHttp = tauriFetch;
