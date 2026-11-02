---
"@nn/entities": patch
---

`LWWRegister.decode`, `LWWMap.decode` and `RGA.decode` now accept any `Encoded` entry and validate their own shape: a register needs a string `metadata.timestamp`, a map needs object `data` and a list needs array `data`. Malformed entries throw `TypeError("Invalid encoded <kind>.")` instead of failing with an unrelated error. `Decoder.decode` takes `unknown`, since `Codec.decode` validates each nested entry.
