---
"@nn/broadcast-sync": major
---

Adds `BroadcastSync`, a sync engine that keeps stores in different tabs, windows and workers of the same origin in sync over the [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).

Attach it with `BroadcastSync.attach(store, name)`. Every store attached under the same channel name receives each change the others make. A store that attaches later asks the others for their state and merges it. Call `sync.detach()` to stop sharing and close the channel.

```ts
import { BroadcastSync } from "@nn/broadcast-sync";
import { IndexDbRepository } from "@nn/indexdb-repository";
import { RepositorySync } from "@nn/repository-sync";

RepositorySync.attach(store, new IndexDbRepository("settings"));
BroadcastSync.attach(store, "settings");
```

`BroadcastSync` doesn't persist anything. Only the fields that changed since a store's engine attached are sent to a newcomer, and a store that's alone on the channel keeps its defaults. Attach `RepositorySync` next to it to keep the state across reloads.

Each store needs its own channel name. `name` defaults to `"nn-default"`, so two different stores attached without a name would overwrite each other's fields that share a name.
