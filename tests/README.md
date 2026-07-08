# Tests

**Status: structure only — suites arrive with their implementation phases.**

| Directory | Purpose |
| --- | --- |
| `unit/` | Package-level unit tests (colocated tests may also live in packages; cross-cutting unit suites live here) |
| `integration/` | Cross-package behavior: capsule lifecycle end-to-end, policy engine wiring |
| `e2e/` | App-level user flows (web/desktop) |
| `fuzz/` | Fuzz targets for hostile-input surfaces — capsule envelope and object parsers (`packages/protocol`) |
| `privacy-regression/` | Machine-checked privacy guarantees: "Ghost mode writes nothing to disk", "no network egress in Offline Capsule mode", "no metadata signals on the wire when disabled" |
| `security-regression/` | Security invariants: replay rejection, quarantine behavior, key material never serialized to logs |

Rules:

- Privacy-relevant behavior requires a privacy-regression test; security-relevant behavior requires a security-regression test ([CONTRIBUTING.md](../CONTRIBUTING.md)).
- Coverage target once implementation begins: 80%+.
- Test fixtures never contain real key material — dedicated, clearly-labeled test keys only.
