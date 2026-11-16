---
"@nn/store": patch
---

Make `Store.update` faster on large collections. Matching a recipe's rows to the stored list allocates less and skips the removal check when no row was removed, which cuts nearly a fifth from an update at 10,000 rows.
