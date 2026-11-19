---
"@nn/broadcast-sync": patch
---

Report an entry from another context that can't be decoded to `onError` and stay connected. Before, the error was thrown from the channel's message handler, where nothing could catch it.
