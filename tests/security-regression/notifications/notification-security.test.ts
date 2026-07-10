/**
 * Security-regression (TECH-12): notification errors, redacted content, and
 * audit events never leak titles/bodies/room-names/sender-aliases or the
 * sentinel; policy resolution touches no platform notification API; the
 * runtime trap and guardrail catch bypass attempts.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  assertNotificationOperationAllowed,
  createRedactedAuditEvent,
  expectedNotificationScope,
  issuePolicyDecision,
  redactNotificationContent,
  resolveBadgePolicy,
  resolveNotificationPolicy,
  resolvePushNotificationPolicy,
  type NotificationOperationRequest,
  type PolicyDecision,
} from "@freelayer/privacy";
import { createNotificationSideEffectTrap } from "../../helpers/notification-trap";

const SENTINEL = "FREELAYER_NOTIFICATION_SENTINEL_DO_NOT_LEAK";

function errorText(fn: () => void): string {
  try {
    fn();
  } catch (error: unknown) {
    return error instanceof Error
      ? `${error.name}: ${error.message} ${error.stack ?? ""}`
      : String(error);
  }
  throw new Error("expected the operation to throw");
}

describe("Errors never leak notification content", () => {
  it("a denied content notification throws a sentinel-free, identifier-free error", () => {
    const request: NotificationOperationRequest = {
      operation: "notification.show",
      contentClass: "message_preview",
      surface: "system_banner",
      reason: "preview",
      payload: { title: SENTINEL, room: "project-alpha", sender: "Alice" },
    };
    const policy = resolveNotificationPolicy({
      mode: "private",
      operation: "notification.show",
      contentClass: "message_preview",
      surface: "system_banner",
    });
    const decision = issuePolicyDecision(
      "notifications",
      "allowed",
      "private",
      expectedNotificationScope("notification.show"),
    );
    const text = errorText(() => assertNotificationOperationAllowed(request, decision, policy));
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain("project-alpha");
    expect(text).not.toContain("Alice");
  });

  it("bypass errors are generic", () => {
    const request: NotificationOperationRequest = {
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
      reason: "indicator",
    };
    const policy = resolveNotificationPolicy({
      mode: "standard",
      operation: "notification.show",
      contentClass: "generic",
      surface: "in_app",
    });
    const forged = {
      id: "pd-forged",
      capability: "notifications",
      sideEffect: "notification.show",
      verdict: "allowed",
      mode: "standard",
      issuedAtLogical: 1,
    } as unknown as PolicyDecision;
    const text = errorText(() => assertNotificationOperationAllowed(request, forged, policy));
    expect(text).toContain("bypass");
    expect(text).not.toContain(SENTINEL);
  });
});

describe("Redacted content and audit never contain the sentinel", () => {
  it("redactNotificationContent drops the input title/body", () => {
    const redacted = redactNotificationContent({
      contentClass: "message_preview",
      title: SENTINEL,
      body: `secret: ${SENTINEL}`,
      mode: "standard",
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain(SENTINEL);
    expect(redacted.title).toBe("FreeLayer");
  });

  it("redacted audit event drops sensitive string details", () => {
    const event = createRedactedAuditEvent({
      kind: "notification_content_denied",
      category: "metadata",
      severity: "warning",
      details: { room: "project-alpha", title: SENTINEL, denied: true },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain("project-alpha");
    expect(event.details).toEqual({ denied: true });
  });
});

describe("No platform notification API touched", () => {
  it("resolving policy / redacting does not call Notification/badge/service-worker APIs", () => {
    const trap = createNotificationSideEffectTrap();
    try {
      resolveNotificationPolicy({
        mode: "standard",
        operation: "notification.show",
        contentClass: "generic",
        surface: "in_app",
      });
      resolveBadgePolicy({ mode: "ghost", contentClass: "activity_count" });
      resolvePushNotificationPolicy({ mode: "standard", contentClass: "generic" });
      redactNotificationContent({
        contentClass: "message_preview",
        title: SENTINEL,
        mode: "ghost",
      });
    } finally {
      trap.uninstall();
    }
    expect(() => trap.assertNoNotificationApiCalled()).not.toThrow();
  });

  it("the trap catches an actual Notification construction attempt", () => {
    const trap = createNotificationSideEffectTrap();
    let threw = false;
    try {
      // @ts-expect-error Notification is trapped for the test
      new globalThis.Notification("x");
    } catch {
      threw = true;
    } finally {
      trap.uninstall();
    }
    expect(threw).toBe(true);
    expect(trap.calls).toContain("new Notification");
  });
});

describe("Notification-bypass guardrail", () => {
  const SCRIPT = "scripts/check-no-notification-bypass.mjs";
  function runScanner(dir: string): { status: number | null; output: string } {
    const result = spawnSync(process.execPath, [SCRIPT, dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  }

  it("catches Notification/badge/service-worker/plugin fixtures", () => {
    const { status, output } = runScanner("tests/fixtures/notification-bypass");
    expect(status).toBe(1);
    expect(output).toContain("new Notification(");
    expect(output).toContain("Notification.requestPermission");
    expect(output).toContain("setAppBadge");
    expect(output).toContain("@tauri-apps/plugin-notification");
  });

  it("passes a clean directory and the approved policy source", () => {
    expect(runScanner("tests/fixtures/clean").status).toBe(0);
    expect(runScanner("packages").status).toBe(0);
  });
});
