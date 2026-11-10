# @nn/observable

## 3.1.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

## 3.0.2

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.

## 3.0.1

### Patch Changes

- 5d1e50e: `Observable.notify` calls every observer even when one throws, then rethrows the first error, so one failing observer no longer hides the notification from the rest.

## 3.0.0

### Major Changes

- 56346fc: Renames the `@nn/observable/Observable` subpath export to `@nn/observable/observable`, so the import path matches the file name. The old path no longer resolves. The root `@nn/observable` export is unchanged.

  ```ts
  // before
  import { Observable } from "@nn/observable/Observable";
  // after
  import { Observable } from "@nn/observable/observable";
  ```

## 2.0.0

### Major Changes

- b04e31b: Renames `Subject` to `Observable` and its export path from `@nn/observable/Subject` to `@nn/observable/Observable`.

  ```ts
  // After
  import { Observable, type Unsubscribe } from "@nn/observable/Observable";
  // Before
  import { Subject, type Unsubscribe } from "@nn/observable/Subject";
  ```

  The `Observer` and `Unsubscribe` types are exported from the new path too.

  `Observable` and `Observer` now take an optional tuple of arguments that `notify()` passes to every observer, for example `new Observable<[ReadonlySet<Entity>]>()`. Without it they behave as before, with observers called without arguments.

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
