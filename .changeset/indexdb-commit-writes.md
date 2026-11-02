---
"@nn/indexdb-repository": patch
---

`IndexDbRepository.set()` commits its transaction once the current task ends, so a write is no longer lost when the page reloads or closes right after a change. A newer write to the same name started in the same task still aborts the older one.
