# Fixture: documentation mention

Documentation may legitimately *mention* forbidden APIs such as localStorage,
sessionStorage, indexedDB, caches.open, or fs.writeFileSync without failing
the guardrail — markdown files are not scanned. This fixture proves it.
