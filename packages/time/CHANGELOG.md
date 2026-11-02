# @nn/time

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
