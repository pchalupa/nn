# @nn/guards

## 0.4.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

## 0.3.1

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.

## 0.3.0

### Minor Changes

- dbd5b8a: Adds an optional `message` argument to `assertArray`, `assertObject`, `assertPlainObject`, and `assertString`. When given, it replaces the default `TypeError` message.

  ```ts
  assertPlainObject(value, "Expected a settings object.");
  ```

- dbd5b8a: Adds `assertPlainObject`, which throws a `TypeError` when the value isn't a plain object.

  ```ts
  import { assertPlainObject } from "@nn/guards/assert-plain-object";
  ```

- dbd5b8a: Adds `isString` and `assertString`. `isString` narrows a value to `string`, and `assertString` throws a `TypeError` when the value isn't one. Boxed `String` objects are rejected.

  ```ts
  import { assertString } from "@nn/guards/assert-string";
  import { isString } from "@nn/guards/is-string";
  ```

## 0.2.0

### Minor Changes

- 56346fc: Renames every subpath export to kebab-case, so import paths match the file names. This is a breaking change: the old paths no longer resolve.

  Update your imports:

  | Before                     | After                        |
  | -------------------------- | ---------------------------- |
  | `@nn/guards/isArray`       | `@nn/guards/is-array`        |
  | `@nn/guards/isObject`      | `@nn/guards/is-object`       |
  | `@nn/guards/isPlainObject` | `@nn/guards/is-plain-object` |
  | `@nn/guards/assertArray`   | `@nn/guards/assert-array`    |
  | `@nn/guards/assertObject`  | `@nn/guards/assert-object`   |

  The exported names are unchanged, so only the module path changes:

  ```ts
  // after
  import { isArray } from "@nn/guards/is-array";
  // before
  import { isArray } from "@nn/guards/isArray";
  ```

## 0.1.0

### Minor Changes

- 8fcddf4: Adds `@nn/guards`, a set of runtime type guards for narrowing `unknown` values. Import each guard from its own subpath:

  ```ts
  import { assertObject } from "@nn/guards/assertObject";
  import { isArray } from "@nn/guards/isArray";

  assertObject(value);

  if (isArray(value.tags)) value.tags.length;
  ```

  `isArray` and `isObject` narrow without throwing, `assertArray` and `assertObject` throw a `TypeError` when the value does not match, and `isPlainObject` accepts only objects whose prototype is `Object.prototype` or `null`.
