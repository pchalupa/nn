---
"@nn/repository": minor
---

Adds an optional `close()` method to `Repository` for implementations that hold a connection.

Sync engines call it when they detach. A repository that holds nothing can leave it out.
