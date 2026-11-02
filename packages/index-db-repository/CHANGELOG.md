# @nn/indexdb-repository

## 1.0.1

### Patch Changes

- ad6f758: `IndexDbRepository.set()` commits its transaction once the current task ends, so a write is no longer lost when the page reloads or closes right after a change. A newer write to the same name started in the same task still aborts the older one.

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

### Minor Changes

- 8fcddf4: `IndexDbRepository` aborts an unfinished write when a newer write to the same name starts, so only the latest entry lands. The superseded `set` rejects.

### Patch Changes

- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [06e1f11]
  - @nn/repository@1.0.0
