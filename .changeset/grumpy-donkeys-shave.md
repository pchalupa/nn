---
"@nn/entities": major
---

Turns `Entity` into an abstract base class generic over the value it holds.

Subclasses have to implement `current` and `merge`. The separate `Mergeable` interface is gone, since `merge` is part of `Entity`.

`LWWMap` takes a record of entities rather than raw values, which lets you nest any entity inside it:

```ts
// Before
new LWWMap({ title: "Buy milk" });

// After
new LWWMap({ title: new LWWRegister("Buy milk") });
```

Also adds `@nn/entities/Entity` to the package exports.
