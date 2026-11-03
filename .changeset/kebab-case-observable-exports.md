---
"@nn/observable": major
---

Renames the `@nn/observable/Observable` subpath export to `@nn/observable/observable`, so the import path matches the file name. The old path no longer resolves. The root `@nn/observable` export is unchanged.

```ts
// before
import { Observable } from "@nn/observable/Observable";
// after
import { Observable } from "@nn/observable/observable";
```
