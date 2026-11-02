---
"@nn/observable": major
---

Renames `@nn/event-emitter` to `@nn/observable` and replaces its contents. `EventEmitter`, `Observable` and `Callback` are removed.

The package root exports `Delegatable<Delegate>`, an interface that declares a single optional `delegate` slot:

```ts
import type { Delegatable } from "@nn/observable";

class Producer implements Delegatable<ProducerDelegate> {
	public delegate?: ProducerDelegate;
}
```

`Unsubscribe` moves to `@nn/observable/Subject`.
