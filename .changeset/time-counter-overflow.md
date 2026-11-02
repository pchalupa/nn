---
"@nn/time": major
---

Keeps every digit of the logical counter in a timestamp, and rejects timestamps `fromTimestamp` cannot read.

`toString()` used to truncate the counter to its last five hexadecimal digits, so two distinct stamps could serialize to the same string. `Time.now()` now throws `CounterOverflowError` instead of letting the counter pass `0xfffff` within one millisecond. Under a hybrid logical clock the counter only grows while physical time stands still, so reaching the bound means clock drift rather than throughput. Counting starts again once physical time moves.

`fromTimestamp` used to accept anything: `"garbage"` gave a `NaN` time and a missing counter became `0`. It now requires a parseable date, a `+`, exactly five lowercase hexadecimal digits, a `+` and a replica id, and throws `TimestampMalformedError` otherwise. Timestamps with extended ISO years round-trip.

```ts
Time.fromTimestamp("");
// throws TimestampMalformedError
```

Catch the call when a timestamp reaches you from outside your own `toString()`. The error classes are internal to the package; match on their `name`.
