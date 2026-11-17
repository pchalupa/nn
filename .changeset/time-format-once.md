---
"@nn/time": patch
---

Make repeated encodes cheaper. A time now formats its timestamp string once and reuses it.
