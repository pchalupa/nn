---
"@nn/repository": major
---

Adds a required `close()` method to `Repository`, which sync engines call when they detach.

Implementations of `Repository` must add it. A repository that holds no connection can implement it as a no-op.
