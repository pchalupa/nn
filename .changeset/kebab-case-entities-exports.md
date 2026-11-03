---
"@nn/entities": major
---

Renames every subpath export to kebab-case, so import paths match the file names. The old paths no longer resolve.

Update your imports:

| Before                           | After                             |
| -------------------------------- | --------------------------------- |
| `@nn/entities/Entity`            | `@nn/entities/entity`             |
| `@nn/entities/Codable`           | `@nn/entities/codable`            |
| `@nn/entities/Codec`             | `@nn/entities/codec`              |
| `@nn/entities/kinds/LWWRegister` | `@nn/entities/kinds/lww-register` |
| `@nn/entities/kinds/LWWMap`      | `@nn/entities/kinds/lww-map`      |
| `@nn/entities/kinds/RGA`         | `@nn/entities/kinds/rga`          |

The exported names are unchanged, so only the module path changes:

```ts
// after
import { LWWMap } from "@nn/entities/kinds/lww-map";
// before
import { LWWMap } from "@nn/entities/kinds/LWWMap";
```
