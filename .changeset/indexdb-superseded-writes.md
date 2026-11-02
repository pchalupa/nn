---
"@nn/indexdb-repository": minor
---

`IndexDbRepository` aborts an unfinished write when a newer write to the same name starts, so only the latest entry lands. The superseded `set` rejects.
