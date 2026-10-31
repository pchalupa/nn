---
"@nn/time": minor
"@nn/entities": minor
"@nn/store": patch
---

Add `Time.epoch()` to create timestamps for untouched defaults, with the same serialized value across replicas.

Epoch timestamps use the nil UUID (`00000000-0000-0000-0000-000000000000`) as their replica ID.

Schema-derived register defaults use epoch so persisted writes take precedence. Ordinary `new LWWRegister(value, key)` construction still timestamps a first write with `Time.now()`, and restored values keep their saved timestamps.

Replace the unreleased `LWWRegister.initial(value, key)` helper with `new LWWRegister(value, key, Time.epoch())`.
