---
"@nn/entities": major
---

Entities report changes to a single `delegate` instead of `subscribe` listeners. The delegate implements `EntityDelegate.entityDidChange(entity, child?)`, where `child` is the direct child whose change caused it. Assigning a new delegate replaces the previous one, and `undefined` detaches it. `LWWMap` and `RGA` become the delegate of their children.

```ts
entity.subscribe(() => {}); // before
entity.delegate = { entityDidChange(entity, child) {} }; // after
```
