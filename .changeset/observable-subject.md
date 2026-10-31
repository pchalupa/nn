---
"@nn/observable": minor
---

Adds `Subject` for notifying many observers. `subscribe(observer)` returns the function that removes it, and `notify(...args)` calls every observer subscribed at that moment.

```ts
import { Subject } from "@nn/observable/Subject";

const changes = new Subject();
const unsubscribe = changes.subscribe(() => {});

changes.notify();
unsubscribe();
```
