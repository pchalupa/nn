---
"@nn/entities": major
---

`LWWMap.current` returns the record of child entities instead of a plain object of their values, and the map no longer mirrors its properties onto the instance.

Reading a property used to unwrap it, which hid the entity and made nesting hard to reason about. Going through the child entity keeps every level of a nested map the same shape:

```ts
const map = new LWWMap({ name: new LWWRegister("John") });

// Before
map.current.name; // "John"
map.name = "Jane";

// After
map.current.name.current; // "John"
map.current.name.current = "Jane";
```

The `current` setter takes entities too, so `set` replaces a property with a new entity rather than a raw value:

```ts
map.set((current) => ({ ...current, name: new LWWRegister("Jane") }));
```

`JSON.stringify(map)` is unchanged and still returns the plain values.
