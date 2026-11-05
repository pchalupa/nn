---
"@nn/guards": minor
---

Adds `isString` and `assertString`. `isString` narrows a value to `string`, and `assertString` throws a `TypeError` when the value isn't one. Boxed `String` objects are rejected.

```ts
import { assertString } from "@nn/guards/assert-string";
import { isString } from "@nn/guards/is-string";
```
