# @goodstate/time

## 7.0.1

### Patch Changes

- 60eb15a: All `@goodstate/*` packages now share one version number and are released together. Install the same version of every `@goodstate/*` package you use. Nothing in the API changed.
- Updated dependencies [60eb15a]
  - @goodstate/cache@7.0.1
  - @goodstate/id@7.0.1

## 2.0.0

### Major Changes

- a91d14d: The package scope is now `@goodstate`. Replace `@nn/` with `@goodstate/` in your dependencies and imports. Nothing else in the API changed.

### Patch Changes

- Updated dependencies [a91d14d]
  - @goodstate/cache@2.0.0
  - @goodstate/id@0.3.0

## 1.2.0

### Minor Changes

- e76db28: Add `Time.receive(remote)`. It moves the clock forward to a later remote time, so the next `Time.now()` is strictly after it even when the local wall clock is behind. Call it with every time received from another replica. Older times are ignored.

  `LWWRegister.decode` now calls `Time.receive`, so a write made after decoding a remote register wins over it even when the local wall clock is behind.

## 1.1.2

### Patch Changes

- bc11520: Make `toString` free on a time parsed with `Time.fromTimestamp`. The time now keeps the timestamp it was parsed from instead of formatting it again, which makes encoding a store right after merging 1,000 remote rows about 10 times faster.

  A timestamp that `fromTimestamp` accepts but `toString` would write differently, such as one without milliseconds or with a UTC offset, now comes back from `toString` unchanged instead of normalized. Comparing times still uses the parsed values, so which write wins does not change.

## 1.1.1

### Patch Changes

- 91a6bc5: Make repeated encodes cheaper. A time now formats its timestamp string once and reuses it.
- Updated dependencies [91a6bc5]
  - @nn/cache@1.0.0

## 1.1.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

### Patch Changes

- 23da839: Depend on other `@nn/*` packages through caret ranges instead of exact versions, so compatible releases share one installed copy instead of duplicating it.
- Updated dependencies [23da839]
  - @nn/id@0.2.0

## 1.0.1

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.
- Updated dependencies [8abc710]
- Updated dependencies [8abc710]
  - @nn/id@0.1.1

## 1.0.0

### Major Changes

- 8fcddf4: Keeps every digit of the logical counter in a timestamp, and rejects timestamps `fromTimestamp` cannot read.

  `toString()` used to truncate the counter to its last five hexadecimal digits, so two distinct stamps could serialize to the same string. `Time.now()` now throws `CounterOverflowError` instead of letting the counter pass `0xfffff` within one millisecond. Under a hybrid logical clock the counter only grows while physical time stands still, so reaching the bound means clock drift rather than throughput. Counting starts again once physical time moves.

  `fromTimestamp` used to accept anything: `"garbage"` gave a `NaN` time and a missing counter became `0`. It now requires a parseable date, a `+`, exactly five lowercase hexadecimal digits, a `+` and a replica id, and throws `TimestampMalformedError` otherwise. Timestamps with extended ISO years round-trip.

  ```ts
  Time.fromTimestamp("");
  // throws TimestampMalformedError
  ```

  Catch the call when a timestamp reaches you from outside your own `toString()`. The error classes are internal to the package; match on their `name`.

### Minor Changes

- 8fcddf4: Add `Time.epoch()` to create timestamps for untouched defaults, with the same serialized value across replicas.

  Epoch timestamps use the nil UUID (`00000000-0000-0000-0000-000000000000`) as their replica ID.

  Schema-derived register defaults use epoch so persisted writes take precedence. Ordinary `new LWWRegister(value, key)` construction still timestamps a first write with `Time.now()`, and restored values keep their saved timestamps.

- 8fcddf4: Stamps every `Time` with the replica that minted it, making timestamp order total.

  Two replicas that wrote in the same millisecond could mint the same `⟨time, counter⟩`. Neither was `isAfter` the other, so `LWWRegister.merge` took no branch: it returned having changed nothing, and the two replicas kept different values while reporting a successful merge. The tie was unreachable within one process, because the shared counter separates two stamps minted in the same millisecond, so this only ever happened across devices.

  `Time` takes the identity of the replica that minted it as a third argument, defaulting to the one the process generates at load. `compare` orders by physical time, then logical time, then that identity, and `isAfter` is defined as `compare(other) > 0`.

  ```ts
  const mine = new Time(1731242350776, 0, "9f1d0b07-…");
  const theirs = new Time(1731242350776, 0, "a01d0b07-…");

  theirs.isAfter(mine); // true, where both were false before
  mine.compare(theirs); // -1
  ```

  Because the order is total, `isAfter` is now true in exactly one direction for any two distinct timestamps. `LWWRegister.merge` and `RGA` element ordering rely on that: a merge of two replicas that stamped the same instant converges, and converges on the same value whichever direction it runs in.

  The serialized form gains a third part, `<ISO 8601 time>+<hex counter>+<replica id>`. It is still fixed width and still sorts lexicographically in comparison order. `Time.fromTimestamp` requires all three parts rather than defaulting the identity, so stored timestamps written before this release must be discarded.

  ```ts
  Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002"); // throws TimestampMalformedError
  ```

  The identity is internal: there is no accessor to read it from a `Time` and no way to supply the process one. Each start therefore generates a fresh identity, so a device is a new replica on every run. That is safe — a fresh UUID never collides and merges stay deterministic — but the set of identities in stored data grows with session count rather than device count, and there is no stable per-device identity to key sync state or debugging on.

  `Time` gains `compare` and now depends on `@nn/id`, so importing it requires `crypto.randomUUID()` at module load rather than at first use.

### Patch Changes

- 8fcddf4: Declares the package as an ES module with `"type": "module"`, so Node loads its source as ESM instead of guessing the format.
- Updated dependencies [8fcddf4]
  - @nn/id@0.1.0
