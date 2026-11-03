---
"@nn/schema": major
---

Renames every schema class subpath export to kebab-case, so import paths match the file names. The old paths no longer resolve. The root `@nn/schema` export is unchanged.

Update your imports:

| Before                         | After                           |
| ------------------------------ | ------------------------------- |
| `@nn/schema/ArraySchema`       | `@nn/schema/array-schema`       |
| `@nn/schema/BooleanSchema`     | `@nn/schema/boolean-schema`     |
| `@nn/schema/EnumerationSchema` | `@nn/schema/enumeration-schema` |
| `@nn/schema/NumberSchema`      | `@nn/schema/number-schema`      |
| `@nn/schema/ObjectSchema`      | `@nn/schema/object-schema`      |
| `@nn/schema/StringSchema`      | `@nn/schema/string-schema`      |

The exported names are unchanged, so only the module path changes:

```ts
// after
import { ObjectSchema } from "@nn/schema/object-schema";
// before
import { ObjectSchema } from "@nn/schema/ObjectSchema";
```
