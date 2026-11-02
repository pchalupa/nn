# @nn/store

## 1.1.0

### Minor Changes

- a33a459: Adds an `enumeration()` schema for a field that holds one of a fixed set of strings.

  ```ts
  import { enumeration, object } from "@nn/schema";

  const ticket = object({
  	status: enumeration("todo", "in-progress", "done"),
  });
  ```

  `InferStateType` types the field as `"todo" | "in-progress" | "done"`, so reads return the union and updates only accept those values. It needs at least one literal. `EnumerationSchema` is exported from `@nn/schema/EnumerationSchema` with a static `is` guard and exposes the list as `literals`.

  The store supports the new schema and fills in the first literal when a field has none.

### Patch Changes

- Updated dependencies [a33a459]
  - @nn/schema@1.1.0

## 1.0.0

### Major Changes

- ccda516: Builds the store from a JSON Schema instead of a map of entity factories.

  `@nn/schema` exports schema builders that mirror JSON Schema types: `string()`, `number()`, `boolean()`, `object()` and `array()`. Each one returns a `Schema` you can annotate with `.entitle()` and `.describe()`, and `InferStateType<S>` gives you the TypeScript type a schema describes.

  `Store.fromSchema()` takes an object schema, and `createStore` in `@nn/react` is the same function:

  ```ts
  // Before
  const store = await createStore({ schema: { todos: (data) => new Collection(data) } });

  // After
  import { array, object, string } from "@nn/schema";

  const store = await createStore({
  	schema: object({ todos: array(object({ id: string(), title: string() })) }),
  });
  ```

- 8fcddf4: Replaces snapshot selectors with `store.state`, a schema-shaped root you read as plain data and update through a draft.

  ```ts
  store.state.read().language; // "cs"

  store.state.update((draft) => {
  	draft.language = "en";
  	draft.tickets.push({ id, title, status });
  });
  ```

  `read()` returns the whole state typed as `InferStateType<typeof schema>`. `update(recipe)` hands the recipe a mutable copy of the root and reconciles it into the store's entities when the recipe returns. `Store.getSnapshotOf`, `Store.events` and the React `Selector` type are removed.

  Every field starts at a default: strings `""`, numbers `0`, booleans `false`, arrays `[]`, and objects with each of their fields defaulted.

  Row identity is internal; rows have no public `key`. Declare your own identifier for lookups and React list keys. Editing a row of the draft keeps its identity, and pushing a new object creates a new row. A new row always lands at the end of its list, wherever it was inserted in the draft, and reordering existing rows has no effect.

- 8fcddf4: Builds a store's entities from the whole schema tree. An object becomes an `LWWMap` of field entities, an array becomes an `RGA` wherever it is declared, and a string, number or boolean becomes an `LWWRegister`. Any of them can be a top-level field.

  ```ts
  const store = await createStore({
  	schema: object({
  		board: object({
  			title: string(),
  			tickets: array(object({ title: string(), tags: array(string()) })),
  		}),
  	}),
  });

  store.state.update((draft) => {
  	draft.board.tickets[0].tags.push("urgent");
  });
  ```

  Each array item gets its own entity, so two replicas that edit different items of the same array keep both edits instead of one array value winning. Object rows are matched to their entities by identity. Scalar items are matched by position, so inserting at the front of a scalar array rewrites each item's value instead of inserting one.

- 8fcddf4: Persists each top-level field as one encoded entity under the field's name, using `Codec` from `@nn/entities`. The stored format changed and existing data is not migrated.

  On startup, `Store.fromSchema` reads every field with `repository.get(name)`, decodes it and merges it into state. A missing entry is skipped. An entry whose key does not match the field is ignored. An entry that is not a valid encoded entity, or has an unknown kind, throws. Stored entries are not checked against the schema. A restored field that changes state is written back once.

  After each change, the changed fields are written again. A failed write is logged with `console.error` and not retried; the `error` event is gone. Writes run independently, without ordering guarantees between updates.

- 8fcddf4: Derive store data types from the schema instead of accepting a separate data type parameter. `Store`, `State`, and the React `use` hook retain the concrete schema type throughout inference.

  Replace explicit `Store<Data>` annotations with `Store<typeof schema>`. `State` no longer accepts a second data type parameter. Replace explicit `use<Data>(store)` calls with `use<typeof schema>(store)`, or omit the type argument and let it infer from the store.

- 8fcddf4: Replaces `store.events` with `store.subscribe`. Listeners are called with no arguments after each state change, and `subscribe` returns the function that removes the listener.

  ```ts
  store.events.on("update", () => {}); // before
  store.subscribe(() => {}); // after
  ```

  `Store` always owns `state.delegate`, so persisting the changed fields starts before any listener runs.

- 06e1f11: Adds a store

### Minor Changes

- 8fcddf4: Adds `State`, which holds the store's entities and reports changes to a single `StateDelegate`. `stateDidChange(state, changed)` receives the changed top-level entities as a `ReadonlySet<Entity>`; each entity's `key` is its field name.

  ```ts
  state.delegate = {
  	stateDidChange: (state, changed) => {
  		for (const entity of changed) persist(entity.key, entity);
  	},
  };
  ```

  `State` takes only the schema. `update` and `merge(name, entity)` each publish a single notification, however many fields change. `merge` ignores an unknown field name and an entity whose key does not match the field.

  `update` does not validate the draft. A list or object field set to a value of the wrong type is left unchanged, scalar fields take whatever value is assigned, and new rows fill missing fields with their schema defaults. An error thrown while the draft is applied keeps the edits already applied and still publishes them.

### Patch Changes

- 8fcddf4: Add `Time.epoch()` to create timestamps for untouched defaults, with the same serialized value across replicas.

  Epoch timestamps use the nil UUID (`00000000-0000-0000-0000-000000000000`) as their replica ID.

  Schema-derived register defaults use epoch so persisted writes take precedence. Ordinary `new LWWRegister(value, key)` construction still timestamps a first write with `Time.now()`, and restored values keep their saved timestamps.

- 8fcddf4: Declares the package as an ES module with `"type": "module"`, so Node loads its source as ESM instead of guessing the format.
- 8fcddf4: Freezes the data `state.read()` returns, so outside code cannot mutate it. Make edits through `state.update()`, which still hands you a mutable draft.

  Snapshots are cached per entity. An update rebuilds only the objects and arrays along the changed branch; unrelated rows and objects keep their references between reads. Writing a value equal to the current one changes nothing and does not notify.

- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [431ad32]
- Updated dependencies [431ad32]
- Updated dependencies [8fcddf4]
- Updated dependencies [ccda516]
- Updated dependencies [8fcddf4]
- Updated dependencies [431ad32]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [ed3de4a]
- Updated dependencies [ccda516]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [06e1f11]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
  - @nn/time@1.0.0
  - @nn/entities@1.0.0
  - @nn/observable@1.0.0
  - @nn/repository@1.0.0
  - @nn/schema@1.0.0
  - @nn/guards@0.1.0
  - @nn/id@0.1.0
