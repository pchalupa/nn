---
"@nn/repository": major
"@nn/indexdb-repository": major
"@nn/store": patch
---

The `Repository` contract speaks entries instead of untyped records.

`@nn/repository` now defines `Entry<Data, Metadata>`, a universal shape of `key`, `data` and `metadata` that the repository stores without interpreting. `get` and `set` are addressed by name and typed to the entry:

```ts
// Before
await repository.set("tickets", record, "tickets");
const stored = await repository.get<unknown>("tickets", "tickets");

// After
await repository.set("tickets", entry);
const stored = await repository.get("tickets"); // Entry | undefined
```

`init(schema)` stays. `delete` and `getAll` leave the interface; `IndexDbRepository` still offers them with their previous signatures. Every `Repository` implementation has to follow the new `get` and `set`.

`IndexDbRepository` keeps its object store per schema property and stores each root's entry under the root name in that store. `set` and `delete` resolve only after their transaction commits, so an aborted transaction rejects the write instead of reporting a successful save.

`@nn/store` specializes the entry into its register and collection shapes. `Store.fromSchema` reads each root with `repository.get(name)` and validates every entry it loads.
