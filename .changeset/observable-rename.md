---
"@nn/observable": major
---

Renames `Subject` to `Observable` and its export path from `@nn/observable/Subject` to `@nn/observable/Observable`.

```ts
// After
import { Observable, type Unsubscribe } from "@nn/observable/Observable";
// Before
import { Subject, type Unsubscribe } from "@nn/observable/Subject";
```

The `Observer` and `Unsubscribe` types are exported from the new path too.

`Observable` and `Observer` now take an optional tuple of arguments that `notify()` passes to every observer, for example `new Observable<[ReadonlySet<Entity>]>()`. Without it they behave as before, with observers called without arguments.
