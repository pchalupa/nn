# @nn/guards

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
