---
"@nn/sync-engine": patch
---

Waits for the transport to open before sending store changes. Changes made while opening aren't queued. The protected `attach()` method now returns a promise and handles initial loading directly.
