---
"@nn/entities": major
---

Fixes decoding of entities encoded by a minified build, which failed with `Unknown entity kind`, by giving `LWWRegister`, `LWWMap` and `RGA` a static `kind`.

`encode()` now writes `metadata.kind` from that `kind` instead of the class name, so a bundler that renames classes no longer changes it. Entries a minified build already stored carry the renamed class name and still fail to decode.

The `Entity` constructor now takes the kind as its first argument and exposes it as the instance's `kind`. `Entity` also declares `static readonly kind: string`, and `Decodable` now requires `kind` instead of `name`. Subclasses of `Entity` must override the static `kind` and pass the same string to `super`.

```ts
// After
class Counter extends Entity<number> {
	public static override readonly kind = "Counter";

	constructor(key?: string) {
		super("Counter", key);
	}
}
// Before
class Counter extends Entity<number> {
	constructor(key?: string) {
		super(key);
	}
}
```
