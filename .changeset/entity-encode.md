---
"@nn/entities": major
---

Adds an abstract `encode` to `Entity`. Each entity encodes itself into an `Encoded` record of its key, data and `metadata.kind`, so persistence no longer has to know the concrete entity classes.

`LWWRegister` stores its timestamp in the metadata, `LWWMap` encodes its fields and `RGA` encodes its items in order. Custom `Entity` subclasses must implement `encode`:

```ts
const map = new LWWMap({ name: new LWWRegister("John", "name") }, "person");

map.encode(); // { key: "person", data: { name: { key: "name", data: "John", metadata: { kind: "LWWRegister", timestamp: "…" } } }, metadata: { kind: "LWWMap" } }
```
