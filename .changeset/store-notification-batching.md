---
"@nn/store": patch
---

Keeps nested updates in one notification batch and notifies subscribers when patch application fails after changing state. If notification also throws, that error takes precedence over the patch error.
