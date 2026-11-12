---
"@nn/store": patch
---

Keep rows that a remote replica removed removed when its list merges into the store. Before, completing the merged list against the schema dropped the remote removals, so a row deleted in one tab stayed in the others.
