---
"@nn/entities": major
---

Fixes decoding of entities encoded by a minified build, which failed with `Unknown entity kind`, by giving `LWWRegister`, `LWWMap` and `RGA` a static `kind`.

`encode()` now writes `metadata.kind` from that static `kind` instead of the class name, so a bundler that renames classes no longer changes it. Entries a minified build already stored carry the renamed class name and still fail to decode.

`Entity` declares `static readonly kind: string`, and `Decodable` now requires `kind` instead of `name`. Entities that implement `Decodable` must override it.

```ts
// After
class Counter extends Entity<number> {
	public static override readonly kind = "Counter";
}
// Before
class Counter extends Entity<number> {}
```
