---
"@nn/sync": major
---

Adds the `Sync` interface that every sync engine returns when it attaches to a store.

A `Sync` has a `restored` promise that settles when the engine's initial restore finishes, and a `detach()` method that stops it. Install this package only to write your own sync engine or to type a variable as `Sync`; the engines depend on it already.
