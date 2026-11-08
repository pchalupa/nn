# @nn/broadcast-sync

Sync engine that shares a store between browsing contexts over a broadcast channel.

## Installation

```sh
npm install @nn/broadcast-sync @nn/store
```

**Requires:** [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

## Usage

Tabs, windows, and workers on the same origin that use the same channel name keep their stores in sync.

```ts
import { BroadcastSync } from "@nn/broadcast-sync";

const sync = new BroadcastSync(store, "todos");

sync.onError((error) => console.error(error));
sync.connect();
```

The channel name defaults to `nn-default`.
