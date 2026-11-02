---
"@nn/observable": minor
---

Adds `Subject` for notifying many observers. `subscribe(observer)` returns the function that removes it, `unsubscribe(observer)` removes it directly, and `notify()` calls every subscribed observer with no arguments.

```ts
import { Subject } from "@nn/observable/Subject";

const changes = new Subject();
const unsubscribe = changes.subscribe(() => {});

changes.notify();
unsubscribe();
```

`@nn/observable/Subject` also exports the `Observer` and `Unsubscribe` types.
