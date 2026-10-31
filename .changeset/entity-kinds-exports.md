---
"@nn/entities": major
---

Groups the concrete entity kinds under `@nn/entities/kinds`, separate from the shared `Entity`, `Codable` and `EntityDecoder` modules. Update imports:

```ts
import { LWWMap } from "@nn/entities/LWWMap"; // before
import { LWWMap } from "@nn/entities/kinds/LWWMap"; // after
```

The same applies to `@nn/entities/LWWRegister` and `@nn/entities/RGA`.
