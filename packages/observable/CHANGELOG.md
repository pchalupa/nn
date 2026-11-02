# @nn/observable

## 1.0.0

### Major Changes

- 8fcddf4: Renames `@nn/event-emitter` to `@nn/observable` and replaces its contents. `EventEmitter`, `Observable` and `Callback` are removed.

  The package root exports `Delegatable<Delegate>`, an interface that declares a single optional `delegate` slot:

  ```ts
  import type { Delegatable } from "@nn/observable";

  class Producer implements Delegatable<ProducerDelegate> {
  	public delegate?: ProducerDelegate;
  }
  ```

  `Unsubscribe` moves to `@nn/observable/Subject`.

- 06e1f11: Adds a store

### Minor Changes

- 8fcddf4: Adds `Subject` for notifying many observers. `subscribe(observer)` returns the function that removes it, `unsubscribe(observer)` removes it directly, and `notify()` calls every subscribed observer with no arguments.

  ```ts
  import { Subject } from "@nn/observable/Subject";

  const changes = new Subject();
  const unsubscribe = changes.subscribe(() => {});

  changes.notify();
  unsubscribe();
  ```

  `@nn/observable/Subject` also exports the `Observer` and `Unsubscribe` types.

### Patch Changes

- 8fcddf4: Declares the package as an ES module with `"type": "module"`, so Node loads its source as ESM instead of guessing the format.
