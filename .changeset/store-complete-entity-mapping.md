---
"@nn/store": patch
---

Deep-freeze state snapshots so mutations to nested objects and arrays cannot corrupt cached data or row identities. Entity mappings now cover all snapshot containers and scalar locations and carry into cloned drafts.

Build snapshots and their mappings together in one root projection. Updates reuse unchanged nested values and mapping nodes, keeping unrelated row and object references stable while rebuilding changed branches.
