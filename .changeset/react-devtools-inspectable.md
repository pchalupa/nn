---
"@nn/react-devtools": minor
---

`Devtools` accepts any object that matches the new `Inspectable` interface instead of requiring a `Store`, so the package no longer depends on `@nn/store`. A `Store` already matches `Inspectable`, so `<Devtools store={store} />` works as before.
