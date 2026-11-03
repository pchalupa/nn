---
"@nn/guards": minor
---

Renames every subpath export to kebab-case, so import paths match the file names. This is a breaking change: the old paths no longer resolve.

Update your imports:

| Before                     | After                        |
| -------------------------- | ---------------------------- |
| `@nn/guards/isArray`       | `@nn/guards/is-array`        |
| `@nn/guards/isObject`      | `@nn/guards/is-object`       |
| `@nn/guards/isPlainObject` | `@nn/guards/is-plain-object` |
| `@nn/guards/assertArray`   | `@nn/guards/assert-array`    |
| `@nn/guards/assertObject`  | `@nn/guards/assert-object`   |

The exported names are unchanged, so only the module path changes:

```ts
// after
import { isArray } from "@nn/guards/is-array";
// before
import { isArray } from "@nn/guards/isArray";
```
