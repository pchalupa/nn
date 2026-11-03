# @nn/schema

## 2.0.0

### Major Changes

- 56346fc: Renames every schema class subpath export to kebab-case, so import paths match the file names. The old paths no longer resolve. The root `@nn/schema` export is unchanged.

  Update your imports:

  | Before                         | After                           |
  | ------------------------------ | ------------------------------- |
  | `@nn/schema/ArraySchema`       | `@nn/schema/array-schema`       |
  | `@nn/schema/BooleanSchema`     | `@nn/schema/boolean-schema`     |
  | `@nn/schema/EnumerationSchema` | `@nn/schema/enumeration-schema` |
  | `@nn/schema/NumberSchema`      | `@nn/schema/number-schema`      |
  | `@nn/schema/ObjectSchema`      | `@nn/schema/object-schema`      |
  | `@nn/schema/StringSchema`      | `@nn/schema/string-schema`      |

  The exported names are unchanged, so only the module path changes:

  ```ts
  // after
  import { ObjectSchema } from "@nn/schema/object-schema";
  // before
  import { ObjectSchema } from "@nn/schema/ObjectSchema";
  ```

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
