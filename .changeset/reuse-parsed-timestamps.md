---
"@nn/time": patch
---

Make `toString` free on a time parsed with `Time.fromTimestamp`. The time now keeps the timestamp it was parsed from instead of formatting it again, which makes encoding a store right after merging 1,000 remote rows about 10 times faster.

A timestamp that `fromTimestamp` accepts but `toString` would write differently, such as one without milliseconds or with a UTC offset, now comes back from `toString` unchanged instead of normalized. Comparing times still uses the parsed values, so which write wins does not change.
