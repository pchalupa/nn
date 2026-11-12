---
"@nn/entities": major
---

Keep rows removed from an `RGA` removed when replicas merge. Before, a merge with a replica that still held the row brought it back.

Removal is now permanent. A `push` under a removed key is ignored, and so is a row whose key was dropped by assigning `current`. If you removed a row and pushed it back under the same key, give it a new key instead. `RGA#map` transforms the rows into a new list that keeps the removed keys.

`encode()` adds the removed keys to `metadata.tombstones`, so encoded lists change shape even when nothing was removed. Decoding requires the field, so lists encoded by earlier versions no longer decode and throw `Invalid encoded RGA.`

`RGA.merge` uses the ES2025 `Set` methods `union` and `difference`, so the package now needs Node 22 or later, or a browser from 2024 or later (Chrome 122, Firefox 127, Safari 17).
