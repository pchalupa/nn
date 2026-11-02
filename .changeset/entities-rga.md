---
"@nn/entities": major
---

Replaces `Collection` and `Slice` with `RGA`, a list of child entities. Import it from `@nn/entities/kinds/RGA`; `@nn/entities/Collection` is gone.

```ts
import { RGA } from "@nn/entities/kinds/RGA";

const tickets = new RGA([row]);

tickets.find(row.key);
tickets.push(other);
tickets.remove(row.key);
```

Items are stored by their `key`, so `find`, `remove` and `merge` do not scan the list. Adding an item whose key is already present merges it into the existing item instead of adding a duplicate. `merge` takes another `RGA` and notifies the delegate only when it adds items. `current` returns a new array on every read.

Items keep insertion order. `RGA` does not order concurrent inserts yet.
