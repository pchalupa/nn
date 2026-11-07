---
"@nn/broadcast-sync": major
"@nn/indexdb-sync": major
"@nn/sse-sync": major
---

Replace static `attach()` factories with public constructors and explicit `connect()` calls. Engines stay idle after construction, so listeners can be registered before synchronization starts. IndexedDB and Broadcast constructors keep `"nn-default"` as the default database or channel name.

Replace `const sync = Engine.attach(store, options)` with:

```ts
const sync = new Engine(store, options);

sync.connect();
```
