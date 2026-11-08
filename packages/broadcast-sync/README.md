# @nn/broadcast-sync

Sync engine that shares a store between browsing contexts over a [broadcast channel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

## Installation

```sh
npm install @nn/broadcast-sync @nn/store
```

## Usage

Tabs, windows, and workers on the same origin that use the same channel name keep their stores in sync.

```ts
import { BroadcastSync } from "@nn/broadcast-sync";

const sync = new BroadcastSync(store, "todos");

sync.onError((error) => console.error(error));
sync.connect();
```

The channel name defaults to `nn-default`.
