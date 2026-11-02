---
"@nn/entities": major
---

Groups the concrete entity kinds under `@nn/entities/kinds`, separate from the shared `Entity`, `Codable` and `Codec` modules. Update imports:

```diff
-import { LWWMap } from "@nn/entities/LWWMap";
+import { LWWMap } from "@nn/entities/kinds/LWWMap";
```

The same applies to `@nn/entities/LWWRegister` and `@nn/entities/RGA`.
