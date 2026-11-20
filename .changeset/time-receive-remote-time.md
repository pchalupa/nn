---
"@nn/time": minor
"@nn/entities": patch
---

Add `Time.receive(remote)`. It moves the clock forward to a later remote time, so the next `Time.now()` is strictly after it even when the local wall clock is behind. Call it with every time received from another replica. Older times are ignored.

`LWWRegister.decode` now calls `Time.receive`, so a write made after decoding a remote register wins over it even when the local wall clock is behind.
