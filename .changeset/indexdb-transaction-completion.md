---
"@nn/indexdb-repository": patch
---

Resolve `set()` and `delete()` only after their IndexedDB transaction commits. A transaction aborted after request success now rejects the write instead of reporting a successful save.
