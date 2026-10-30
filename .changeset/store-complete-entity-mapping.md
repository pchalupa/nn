---
"@nn/store": patch
---

Deep-freeze state snapshots so mutations to nested objects and arrays cannot corrupt cached data or row identities. Entity mappings now cover all snapshot containers and scalar locations and carry into cloned drafts.
