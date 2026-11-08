# @nn/indexdb-sync

Sync engine that persists a store to [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

## Installation

```sh
npm install @nn/indexdb-sync @nn/store
```

## Usage

The engine loads saved state into the store when it connects and saves every change after that.

```ts
import { IndexDbSync } from "@nn/indexdb-sync";

const sync = new IndexDbSync(store, "todos");

sync.onError((error) => console.error(error));
sync.connect();
```

The database name defaults to `nn-default`.
