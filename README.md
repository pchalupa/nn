# nn

Local-first state management for TypeScript. You describe your state with a schema, and a store keeps it in [conflict-free replicated data types](https://crdt.tech/) (CRDTs), so changes made offline, in other tabs, or on other devices merge into the same result. Sync engines connect the store to IndexedDB, other tabs, or a server.

## Quick start

```sh
npm install @nn/react @nn/schema @nn/indexdb-sync @nn/sse-sync
```

```ts
import { IndexDbSync } from "@nn/indexdb-sync";
import { createStore } from "@nn/react";
import { array, object, string } from "@nn/schema";
import { SseSync } from "@nn/sse-sync";

export const { store, useRead, useUpdate } = createStore(
	object({ todos: array(object({ id: string(), title: string() })) }),
);

const persistence = new IndexDbSync(store);
const remote = new SseSync(store, new URL("https://example.com/sync"));

remote.onError((error) => console.error(error));

persistence.connect();
remote.connect();
```

`IndexDbSync` saves the state on the device and `SseSync` syncs it with a server. Use either one or both. Engines start idle, so you can add listeners before calling `connect()`.

## Examples

- [`apps/example-react`](apps/example-react) is a kanban board that works offline, syncs between tabs, and merges edits from other devices through a server.
- [`apps/example-node`](apps/example-node) watches this repository for `TODO` comments and adds them to the board as tickets over server-sent events.
- [`apps/example-schema`](apps/example-schema) holds the schema both apps share.

