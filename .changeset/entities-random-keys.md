---
"@nn/entities": major
---

Gives every entity a `key`. Pass one to the constructor, or the entity generates a UUID v4 through `ID.create()` from `@nn/id`. Supplied keys, including keys restored from storage, are kept exactly.

Generated keys carry no chronological order. The runtime must provide native `globalThis.crypto.randomUUID()`; browsers must run in a secure context.
