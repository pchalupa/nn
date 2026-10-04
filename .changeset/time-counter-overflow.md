---
"@nn/time": major
---

Keeps every digit of the logical counter in a timestamp, and rejects a timestamp no `Time` could have produced.

`toString()` truncated the counter to the last five hexadecimal digits, so `1048576` serialized as `+00000` and read back as `0`. Two distinct stamps collapsed onto one string, which changes the outcome wherever a timestamp identifies a value, such as element identity in an `RGA`.

The five digit field stays, and the counter is now bounded where it is minted instead of trimmed where it is written:

```ts
// Before
new Time(0, 0x100000).toString();
// "1970-01-01T00:00:00.000Z+00000"

// After
new Time(0, 0x100000);
// throws: Logical counter 1048576 is not an integer between 0 and 1048575.
```

Under a hybrid logical clock the counter only grows while physical time stands still, so reaching the bound means clock drift rather than throughput. `Time.now()` refuses there too, rather than handing the shared clock a value no timestamp can carry, and it starts counting again once physical time moves. A physical time that is not a millisecond instant is refused the same way.

`fromTimestamp` is strict. It used to take anything: `"garbage"` gave a `NaN` time, `"2024-11-10T12:39:10.776Z+0000g"` parsed to `0`, and a missing counter silently became `0`. It now wants a canonical ISO 8601 instant in UTC, a `+`, and exactly five lowercase hexadecimal digits:

```ts
// Before
Time.fromTimestamp("").getTime();
// 0

// After
Time.fromTimestamp("");
// throws: Timestamp "" is not a physical time and a logical counter.
```

Catch the call when a timestamp reaches you from outside your own `toString()`. The errors carry the names `CounterOverflowError`, `InvalidTimeError` and `InvalidTimestampError`, and the classes stay internal to the package.
