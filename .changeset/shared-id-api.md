---
"@nn/id": minor
---

Adds `ID.create(): string` for local UUID v4 generation without replica coordination. Import `ID` from `@nn/id`; returned strings are opaque identities with no chronological ordering guarantee.

Requires native `globalThis.crypto.randomUUID()`. Browsers must run in a secure context. Generation errors propagate to the caller.
