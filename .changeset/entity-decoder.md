---
"@nn/entities": minor
---

Adds decoding of encoded entities. Each entity encodes its constructor name as `metadata.kind` and gains a static `decode` that rebuilds it, passing nested entities to a `Decoder`. `@nn/entities/Codable` exports the `Encodable`, `Decodable`, `Decoder` and `Encoded` contracts. `LWWMap.get` and `LWWMap.merge` no longer treat inherited `Object.prototype` members, such as `constructor`, as fields.

```ts
LWWRegister.decode(register.encode()); // an LWWRegister equal to register
```
