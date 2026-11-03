---
"@nn/entities": major
---

Fixes decoding of entities encoded by a minified build, which failed with `Unknown entity kind`, by giving every entity an explicit `kind`.

The `Entity` constructor now takes the kind as its first argument and exposes it as the instance's `kind`. `encode()` writes `metadata.kind` from it instead of the class name, so a bundler that renames classes no longer changes it. Entries a minified build already stored carry the renamed class name and still fail to decode.

Subclasses of `Entity` must pass their kind to `super`. `Decodable` no longer requires `name`.

```ts
// After
class Counter extends Entity<number> {
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
