---
"@nn/schema": major
"@nn/store": major
"@nn/react": major
---

Builds the store from a JSON Schema instead of a map of entity factories.

`@nn/schema` now exports schema builders that mirror JSON Schema types: `string()`, `number()`, `boolean()`, `object()` and `array()`. Each one returns a `Schema` you can annotate with `.entitle()` and `.describe()`, and the `Infer<S>` type gives you the TypeScript type a schema describes.

`Store.fromSchema()` reads the top-level properties of an object schema and creates a `Collection` for each one. `createStore` in `@nn/react` takes the same schema and delegates to it. Every top-level property has to be an array schema; anything else throws a `TypeError`.

```ts
// Before
const store = await createStore({ schema: { todos: (data) => new Collection(data) } });

// After
import { array, object, string } from "@nn/schema";

const store = await createStore({
	schema: object({ todos: array(object({ id: string(), title: string() })) }),
});
```

`Store.getSnapshotOf()` and the React `Selector` type now require the selected value to be `Observable`, so a selector has to return an entity such as a `Collection` or a `Slice`, not a plain value.
