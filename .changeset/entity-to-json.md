---
"@nn/entities": minor
---

Adds `toJSON` to `Entity`, so `JSON.stringify` on an entity returns its current value.

```ts
const map = new LWWMap({ name: new LWWRegister("John") });

JSON.stringify(map); // '{"name":"John"}'
```
