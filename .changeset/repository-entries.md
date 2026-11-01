---
"@nn/repository": major
"@nn/indexdb-repository": major
"@nn/entities": major
---

Defines the stored `Entry<Data, Metadata>` shape of `key`, `data` and `metadata` in `@nn/repository` as a structural slot. `@nn/entities/Codec` encodes entities to the `Encoded` shape from `@nn/entities/Codable`, which fits that slot without a dependency between the packages, and decodes any stored value. `get` and `set` are addressed by name and typed to the entry:

```ts
// Before
await repository.set("tickets", record, "tickets");
const stored = await repository.get<unknown>("tickets", "tickets");

// After
await repository.set("tickets", entry);
const stored = await repository.get("tickets");
```

`init(schema)` stays. `delete` and `getAll` leave the interface; `IndexDbRepository` still offers them, with `getAll` returning `Entry[]`. Every `Repository` implementation has to follow the new `get` and `set`.

`@nn/entities` newly exports `./Codec` with the `Codec` class.

`IndexDbRepository` keeps its object store per schema property and stores each root's entry under the root name in that store. `set` and `delete` resolve only after their transaction commits, so an aborted transaction rejects the write instead of reporting a successful save.

`@nn/store` specializes the entry into its register and collection shapes. `Store.fromSchema` reads each root with `repository.get(name)` and validates every entry it loads.
