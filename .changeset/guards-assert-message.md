---
"@nn/guards": minor
---

Adds an optional `message` argument to `assertArray`, `assertObject`, `assertPlainObject`, and `assertString`. When given, it replaces the default `TypeError` message.

```ts
assertPlainObject(value, "Expected a settings object.");
```
