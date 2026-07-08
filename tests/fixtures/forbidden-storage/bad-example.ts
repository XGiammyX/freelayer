// FIXTURE — intentionally violates the forbidden-storage guardrail.
// Scanned ONLY when tests pass this directory explicitly to
// scripts/check-no-forbidden-storage.mjs; default scans cover apps/ and
// packages/ and never reach tests/fixtures. Not typechecked, not run.
declare const fsShim: { writeFileSync(path: string, value: string): void };
declare const caches: { open(name: string): Promise<unknown> };

export function badPersistence(value: string): void {
  window.localStorage.setItem("k", value);
  const db = window.indexedDB;
  void db;
  void caches.open("cache");
  fsShim.writeFileSync("/tmp/x", value);
}
