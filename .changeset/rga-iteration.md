---
"@nn/entities": minor
---

`RGA` is iterable and exposes its removed keys as a read-only `tombstones` set. Iteration runs over the items present when it starts, so adding or removing items inside the loop is safe. `tombstones` is a live view that reflects later removals, including ones a merge brings in.
