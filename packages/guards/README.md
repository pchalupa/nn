# @goodstate/guards

Runtime type guards.

## Installation

```sh
npm install @goodstate/guards
```

## Usage

`is*` functions narrow a value in a condition. `assert*` functions throw a `TypeError` with an optional message when the value doesn't match.

```ts
import { assertString } from "@goodstate/guards/assert-string";
import { isPlainObject } from "@goodstate/guards/is-plain-object";

const value: unknown = JSON.parse(input);

if (isPlainObject(value)) {
	assertString(value.name, "Expected a name.");
}
```
