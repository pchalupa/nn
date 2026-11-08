# @nn/guards

Runtime type guards.

## Installation

```sh
npm install @nn/guards
```

## Usage

`is*` functions narrow a value in a condition. `assert*` functions throw a `TypeError` with an optional message when the value doesn't match.

```ts
import { assertString } from "@nn/guards/assert-string";
import { isPlainObject } from "@nn/guards/is-plain-object";

const value: unknown = JSON.parse(input);

if (isPlainObject(value)) {
	assertString(value.name, "Expected a name.");
}
```
