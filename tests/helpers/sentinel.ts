/**
 * Sentinel-based leak-detection helpers (TECH-06). Tests write this sentinel
 * as a stored value and assert it never appears in errors, console output,
 * or list metadata. Never use real secrets in tests.
 */
import { expect } from "vitest";

export const SENTINEL = "FREELAYER_SECRET_SENTINEL_DO_NOT_LEAK";

type ConsoleMethod = "log" | "warn" | "error" | "debug" | "info";
const METHODS: readonly ConsoleMethod[] = ["log", "warn", "error", "debug", "info"];

/** Runs fn while capturing all console output; restores console afterwards. */
export async function captureConsoleOutput(fn: () => Promise<void> | void): Promise<string> {
  const captured: string[] = [];
  const originals = new Map<ConsoleMethod, (typeof console)[ConsoleMethod]>();
  for (const method of METHODS) {
    originals.set(method, console[method]);
    console[method] = (...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "));
    };
  }
  try {
    await fn();
  } finally {
    for (const method of METHODS) {
      const original = originals.get(method);
      if (original !== undefined) {
        console[method] = original;
      }
    }
  }
  return captured.join("\n");
}

export function assertOutputDoesNotContainSentinel(output: string): void {
  expect(output).not.toContain(SENTINEL);
}

/** Awaits a rejecting/throwing operation and asserts the error is sentinel-free. */
export async function assertErrorDoesNotContainSentinel(
  operation: () => Promise<unknown> | unknown,
): Promise<string> {
  try {
    await operation();
  } catch (error: unknown) {
    const text =
      error instanceof Error
        ? `${error.name}: ${error.message} ${error.stack ?? ""}`
        : String(error);
    expect(text).not.toContain(SENTINEL);
    return text;
  }
  throw new Error("expected the operation to throw");
}
