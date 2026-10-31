---
"@nn/store": patch
"@nn/entities": patch
"@nn/indexdb-repository": minor
---

Lower memory use and less garbage per update. A `Store` without a repository no longer observes state changes.

`IndexDbRepository` cancels an unfinished write when a newer write to the same name starts. The superseded `set` resolves, and only the latest entry lands.
