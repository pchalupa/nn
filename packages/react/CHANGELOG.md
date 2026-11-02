# @nn/react

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

- 8fcddf4: `use(store)` returns two hooks, `useRead` for reads and `useUpdate` for writes, instead of handing components the live entity.

  A component used to receive the entity itself, read it through `.current`, and write to the same object it rendered. Reads and writes now have separate hooks. `useRead(selector)` returns frozen plain data. `useUpdate()` returns a stable updater and never subscribes, so a component that only writes does not re-render when the state changes.

  ```tsx
  const { useRead, useUpdate } = use(store);

  const tickets = useRead((data) => data.tickets.filter((ticket) => ticket.status === status));
  const update = useUpdate();

  update((draft) => {
  	draft.tickets.push({ id, title, status });
  });
  ```

  A register works the same way, and its value is the value itself:

  ```tsx
  const language = useRead((data) => data.language);
  const update = useUpdate();

  language; // "cs"
  update((draft) => {
  	draft.language = "en";
  });
  ```

  Two fixes come with it. The selector is read fresh on every render, so a selector that closes over a prop no longer keeps filtering by the value it had at mount. And `getServerSnapshot` is passed, so rendering on the server no longer throws.

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

- 8fcddf4: Derive store data types from the schema instead of accepting a separate data type parameter. `Store`, `State`, and the React `use` hook retain the concrete schema type throughout inference.

  Replace explicit `Store<Data>` annotations with `Store<typeof schema>`. `State` no longer accepts a second data type parameter. Replace explicit `use<Data>(store)` calls with `use<typeof schema>(store)`, or omit the type argument and let it infer from the store.

- 06e1f11: Adds a store

### Patch Changes

- 88b75a8: Updates React to 19.3.0.
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [ccda516]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
- Updated dependencies [06e1f11]
  - @nn/store@1.0.0
  - @nn/guards@0.1.0
