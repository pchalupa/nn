---
"@nn/entities": major
"@nn/schema": major
---

Moves `Collection` to `@nn/entities` and turns `Entity` into an abstract base class.

`Collection` and `Slice` now live in `@nn/entities/Collection`. Import them from there instead of `@nn/schema/Collection`, which is gone. A collection is an entity now, so it has a `current` getter and setter and emits an update whenever its data changes.

`Entity` is abstract and generic over the value it holds. Subclasses have to implement `current` and `merge`. The separate `Mergeable` interface is gone, since `merge` is part of `Entity`.

`LWWMap` takes a record of entities rather than raw values, which lets you nest any entity inside it:

```ts
// Before
new LWWMap({ title: "Buy milk" });

// After
new LWWMap({ title: new LWWRegister("Buy milk") });
```

Also adds `@nn/entities/Entity` to the package exports.
