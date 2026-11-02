# @nn/schema

## 1.0.0

### Major Changes

- ed3de4a: Exports every schema class from its own subpath and adds a static `is` type guard to each, so you can branch on a schema shape and keep the type.

  ```ts
  import { ArraySchema } from "@nn/schema/ArraySchema";

  if (ArraySchema.is(shape)) {
  	shape.items; // Schema
  }
  ```

  Import `StringSchema`, `NumberSchema`, `BooleanSchema`, `ObjectSchema` and `ArraySchema` from `@nn/schema/<ClassName>`. `Schema.is` matches any schema. The guards check the instance, not the `type` field, so a plain object that looks like a schema does not pass.

  The package root keeps the builders and the `Schema` type but no longer exports the `ArraySchema` and `ObjectSchema` types. `Infer` is renamed `InferStateType`:

  ```ts
  import type { Infer } from "@nn/schema"; // before
  import type { InferStateType } from "@nn/schema"; // after
  ```

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

### Patch Changes

- 8fcddf4: Declares the package as an ES module with `"type": "module"`, so Node loads its source as ESM instead of guessing the format.
