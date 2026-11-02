---
"@nn/entities": minor
"@nn/time": minor
---

Stamps every `Time` with the replica that minted it, making timestamp order total.

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
