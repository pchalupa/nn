---
"@nn/schema": major
"@nn/store": major
"@nn/react": major
---

Builds the store from a JSON Schema instead of a map of entity factories.

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
