// FIXTURE — intentionally violates the forbidden-network guardrail. Scanned
// ONLY when tests pass this directory explicitly; default scans cover apps/
// and packages/ and never reach tests/fixtures. Not typechecked, not run.
declare const navigator: { sendBeacon(url: string, data?: string): boolean };

export async function badNetwork(): Promise<void> {
  await fetch("https://example.com/data");
  const ws = new WebSocket("wss://example.com");
  void ws;
  const pc = new RTCPeerConnection();
  void pc;
  navigator.sendBeacon("https://telemetry.example.com", "ping");
}
