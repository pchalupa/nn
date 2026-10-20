---
"@nn/entities": major
---

Generates entity keys through `ID.create()` from `@nn/id`, replacing timestamp-based keys with UUID v4 strings. Keys are still generated lazily and remain stable. Supplied keys, including existing stored keys, are preserved exactly.

New keys no longer sort chronologically. Replace key-based time comparisons with explicit `Time` values. The runtime must provide native `globalThis.crypto.randomUUID()`; browsers must run in a secure context.
