---
"@nn/store": patch
---

Fill fields missing from merged data with their zero values. Data saved before a field was added to the schema no longer reads back as `undefined` for that field.
