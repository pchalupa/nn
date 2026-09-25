---
"@nn/entities": minor
"@nn/store": patch
---

Adds `toJSON` to `Entity`, so `JSON.stringify` on an entity returns its current value.

A snapshot id is the stringified state now, which means it changes whenever the data changes. `Collection.toString` is gone, because `JSON.stringify` covers it:

```ts
const map = new LWWMap({ name: new LWWRegister("John") });

JSON.stringify(map); // '{"name":"John"}'
```
