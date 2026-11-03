# @nn/repository

## 2.0.0

### Major Changes

- b04e31b: Adds a required `close()` method to `Repository`, which sync engines call when they detach.

  Implementations of `Repository` must add it. A repository that holds no connection can implement it as a no-op.

## 1.0.0

### Major Changes

- 8fcddf4: Defines the stored `Entry<Data, Metadata>` shape of `key`, `data` and `metadata` in `@nn/repository` as a structural slot. `@nn/entities/Codec` encodes entities to the `Encoded` shape from `@nn/entities/Codable`, which fits that slot without a dependency between the packages, and decodes any stored value. `get` and `set` are addressed by name and typed to the entry:

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

- 06e1f11: Adds a store

### Patch Changes

- 8fcddf4: Declares the package as an ES module with `"type": "module"`, so Node loads its source as ESM instead of guessing the format.
