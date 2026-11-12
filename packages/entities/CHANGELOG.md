# @nn/entities

## 3.1.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

### Patch Changes

- 23da839: Depend on other `@nn/*` packages through caret ranges instead of exact versions, so compatible releases share one installed copy instead of duplicating it.
- Updated dependencies [23da839]
- Updated dependencies [23da839]
  - @nn/guards@0.4.0
  - @nn/id@0.2.0
  - @nn/observable@3.1.0
  - @nn/time@1.1.0

## 3.0.1

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.
- Updated dependencies [8abc710]
- Updated dependencies [8abc710]
  - @nn/guards@0.3.1
  - @nn/id@0.1.1
  - @nn/observable@3.0.2
  - @nn/time@1.0.1

## 3.0.0

### Major Changes

- 56346fc: Renames every subpath export to kebab-case, so import paths match the file names. The old paths no longer resolve.

  Update your imports:

  | Before                           | After                             |
  | -------------------------------- | --------------------------------- |
  | `@nn/entities/Entity`            | `@nn/entities/entity`             |
  | `@nn/entities/Codable`           | `@nn/entities/codable`            |
  | `@nn/entities/Codec`             | `@nn/entities/codec`              |
  | `@nn/entities/kinds/LWWRegister` | `@nn/entities/kinds/lww-register` |
  | `@nn/entities/kinds/LWWMap`      | `@nn/entities/kinds/lww-map`      |
  | `@nn/entities/kinds/RGA`         | `@nn/entities/kinds/rga`          |

  The exported names are unchanged, so only the module path changes:

  ```ts
  // after
  import { LWWMap } from "@nn/entities/kinds/lww-map";
  // before
  import { LWWMap } from "@nn/entities/kinds/LWWMap";
  ```

### Patch Changes

- Updated dependencies [56346fc]
- Updated dependencies [56346fc]
  - @nn/guards@0.2.0
  - @nn/observable@3.0.0

## 2.0.0

### Major Changes

- ffb3760: Fixes decoding of entities encoded by a minified build, which failed with `Unknown entity kind`, by giving every entity an explicit `kind`.

  The `Entity` constructor now takes the kind as its first argument and exposes it as the instance's `kind`. `encode()` writes `metadata.kind` from it instead of the class name, so a bundler that renames classes no longer changes it. Entries a minified build already stored carry the renamed class name and still fail to decode.

  Subclasses of `Entity` must pass their kind to `super`. `Decodable` no longer requires `name`.

  ```ts
  // After
  class Counter extends Entity<number> {
  	constructor(key?: string) {
  		super("Counter", key);
  	}
  }
  // Before
  class Counter extends Entity<number> {
  	constructor(key?: string) {
  		super(key);
  	}
  }
  ```

## 1.0.0

### Major Changes

- 8fcddf4: Gives every entity a `key`. Pass one to the constructor, or the entity generates a UUID v4 through `ID.create()` from `@nn/id`. Supplied keys, including keys restored from storage, are kept exactly.

  Generated keys carry no chronological order. The runtime must provide native `globalThis.crypto.randomUUID()`; browsers must run in a secure context.

- 8fcddf4: Replaces `Collection` and `Slice` with `RGA`, a list of child entities. Import it from `@nn/entities/kinds/RGA`; `@nn/entities/Collection` is gone.

  ```ts
  import { RGA } from "@nn/entities/kinds/RGA";

  const tickets = new RGA([row]);

  tickets.find(row.key);
  tickets.push(other);
  tickets.remove(row.key);
  ```

  Items are stored by their `key`, so `find`, `remove` and `merge` do not scan the list. Adding an item whose key is already present merges it into the existing item instead of adding a duplicate. `merge` takes another `RGA` and notifies the delegate only when it adds items. `current` returns a new array on every read.

  Items keep insertion order. `RGA` does not order concurrent inserts yet.

- 8fcddf4: Entities report changes to a single `delegate` instead of `subscribe` listeners. The delegate implements `EntityDelegate.entityDidChange(entity, child?)`, where `child` is the direct child whose change caused it. Assigning a new delegate replaces the previous one, and `undefined` detaches it. `LWWMap` and `RGA` become the delegate of their children.

  ```ts
  entity.subscribe(() => {}); // before
  entity.delegate = { entityDidChange(entity, child) {} }; // after
  ```

- 8fcddf4: Adds an abstract `encode` to `Entity`. Each entity encodes itself into an `Encoded` record of its key, data and `metadata.kind`, so persistence no longer has to know the concrete entity classes.

  `LWWRegister` stores its timestamp in the metadata, `LWWMap` encodes its fields and `RGA` encodes its items in order. Custom `Entity` subclasses must implement `encode`:

  ```ts
  const map = new LWWMap({ name: new LWWRegister("John", "name") }, "person");

  map.encode(); // { key: "person", data: { name: { key: "name", data: "John", metadata: { kind: "LWWRegister", timestamp: "…" } } }, metadata: { kind: "LWWMap" } }
  ```

- 8fcddf4: Groups the concrete entity kinds under `@nn/entities/kinds`, separate from the shared `Entity`, `Codable` and `Codec` modules. Update imports:

  ```diff
  -import { LWWMap } from "@nn/entities/LWWMap";
  +import { LWWMap } from "@nn/entities/kinds/LWWMap";
  ```

  The same applies to `@nn/entities/LWWRegister` and `@nn/entities/RGA`.

- ccda516: Turns `Entity` into an abstract base class generic over the value it holds.

  Subclasses have to implement `current` and `merge`. The separate `Mergeable` interface is gone, since `merge` is part of `Entity`.

  `LWWMap` takes a record of entities rather than raw values, which lets you nest any entity inside it:

  ```ts
  // Before
  new LWWMap({ title: "Buy milk" });

  // After
  new LWWMap({ title: new LWWRegister("Buy milk") });
  ```

  Also adds `@nn/entities/Entity` to the package exports.

- 431ad32: `LWWMap.current` returns the record of child entities instead of a plain object of their values, and the map no longer mirrors its properties onto the instance.

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

- 8fcddf4: Add `Time.epoch()` to create timestamps for untouched defaults, with the same serialized value across replicas.

  Epoch timestamps use the nil UUID (`00000000-0000-0000-0000-000000000000`) as their replica ID.

  Schema-derived register defaults use epoch so persisted writes take precedence. Ordinary `new LWWRegister(value, key)` construction still timestamps a first write with `Time.now()`, and restored values keep their saved timestamps.

- 8fcddf4: Export `InferValueType<Value>` from `@nn/entities/Entity` to infer plain value types recursively from registers, maps, and collections.
- 8fcddf4: Adds a static `is` type guard to every entity class, so you can branch on an entity kind and keep the type.

  `LWWMap.is(value)` takes an `unknown` value and narrows it to `LWWMap`:

  ```ts
  import { LWWMap } from "@nn/entities/kinds/LWWMap";

  if (LWWMap.is(entity)) {
  	entity.get("title"); // Entity | undefined
  }
  ```

  `Entity.is` matches any entity, and `LWWRegister`, `LWWMap` and `RGA` override it with their own. The guards check the instance, so a plain object that looks like an entity does not pass.

  Each class also has a static `assert` that narrows the same way but throws a `TypeError` when the value is not that entity:

  ```ts
  LWWMap.assert(entity);
  entity.get("title"); // Entity | undefined
  ```

- 8fcddf4: Adds decoding of encoded entities. Each entity encodes its constructor name as `metadata.kind` and gains a static `decode` that rebuilds it, passing nested entities to a `Decoder`. `@nn/entities/Codable` exports the `Encodable`, `Decodable`, `Decoder` and `Encoded` contracts. `LWWMap.get` and `LWWMap.merge` no longer treat inherited `Object.prototype` members, such as `constructor`, as fields.

  ```ts
  LWWRegister.decode(register.encode()); // an LWWRegister equal to register
  ```

- 431ad32: Adds `Entity.set(updater)`, one method every entity shares for writing without an assignment.

  ```ts
  language.set((current) => (current === "cs" ? "en" : "cs"));
  ```

  The updater receives the current value and returns the next one, so a write always reads from the current state. Assigning to `current` keeps working.

- 431ad32: Adds `toJSON` to `Entity`, so `JSON.stringify` on an entity returns its current value.

  ```ts
  const map = new LWWMap({ name: new LWWRegister("John") });

  JSON.stringify(map); // '{"name":"John"}'
  ```

- 8fcddf4: Add `LWWMap.get()` for reading one field entity by name.
- 8fcddf4: Stamps every `Time` with the replica that minted it, making timestamp order total.

  Two replicas that wrote in the same millisecond could mint the same `⟨time, counter⟩`. Neither was `isAfter` the other, so `LWWRegister.merge` took no branch: it returned having changed nothing, and the two replicas kept different values while reporting a successful merge. The tie was unreachable within one process, because the shared counter separates two stamps minted in the same millisecond, so this only ever happened across devices.

  `Time` takes the identity of the replica that minted it as a third argument, defaulting to the one the process generates at load. `compare` orders by physical time, then logical time, then that identity, and `isAfter` is defined as `compare(other) > 0`.

  ```ts
  const mine = new Time(1731242350776, 0, "9f1d0b07-…");
  const theirs = new Time(1731242350776, 0, "a01d0b07-…");

  theirs.isAfter(mine); // true, where both were false before
  mine.compare(theirs); // -1
  ```

  Because the order is total, `isAfter` is now true in exactly one direction for any two distinct timestamps. `LWWRegister.merge` and `RGA` element ordering rely on that: a merge of two replicas that stamped the same instant converges, and converges on the same value whichever direction it runs in.

  The serialized form gains a third part, `<ISO 8601 time>+<hex counter>+<replica id>`. It is still fixed width and still sorts lexicographically in comparison order. `Time.fromTimestamp` requires all three parts rather than defaulting the identity, so stored timestamps written before this release must be discarded.

  ```ts
  Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002"); // throws TimestampMalformedError
  ```

  The identity is internal: there is no accessor to read it from a `Time` and no way to supply the process one. Each start therefore generates a fresh identity, so a device is a new replica on every run. That is safe — a fresh UUID never collides and merges stay deterministic — but the set of identities in stored data grows with session count rather than device count, and there is no stable per-device identity to key sync state or debugging on.

  `Time` gains `compare` and now depends on `@nn/id`, so importing it requires `crypto.randomUUID()` at module load rather than at first use.

### Patch Changes

- 8fcddf4: `LWWRegister.decode`, `LWWMap.decode` and `RGA.decode` now accept any `Encoded` entry and validate their own shape: a register needs a string `metadata.timestamp`, a map needs object `data` and a list needs array `data`. Malformed entries throw `TypeError("Invalid encoded <kind>.")` instead of failing with an unrelated error. `Decoder.decode` takes `unknown`, since `Codec.decode` validates each nested entry.
- 8fcddf4: Declares the package as an ES module with `"type": "module"`, so Node loads its source as ESM instead of guessing the format.
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [06e1f11]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
  - @nn/time@1.0.0
  - @nn/observable@1.0.0
  - @nn/guards@0.1.0
  - @nn/id@0.1.0
