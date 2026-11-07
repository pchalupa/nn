---
"@nn/react": major
---

Return `store`, `useRead`, and `useUpdate` directly from `createStore(schema)`, so hooks no longer need a separate setup call.

The `use(store)` export is removed. Destructure the store and hooks from `createStore` instead. The hooks behave as before, and `store` remains available for sync engines and direct reads and writes.

Before:

```ts
import { createStore, use } from "@nn/react";

const store = createStore(schema);
const { useRead, useUpdate } = use(store);
```

After:

```ts
import { createStore } from "@nn/react";

const { store, useRead, useUpdate } = createStore(schema);
```
