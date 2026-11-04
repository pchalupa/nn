---
"@nn/store": minor
---

`State` can encode its whole tree with `state.encode()`. The result is a snapshot keyed by top-level field, so tooling like devtools can read the state without holding live entities.
