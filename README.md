<img alt="Goodstate. State that survives the dark side. Local-first state for TypeScript." src="https://raw.githubusercontent.com/pchalupa/goodstate/main/docs/design/assets/readme-banner.jpg" width="836" />

# Goodstate

Local-first state management for TypeScript. You describe your state with a schema, and a store keeps it in [conflict-free replicated data types](https://crdt.tech/) (CRDTs), so changes made offline, in other tabs, or on other devices merge into the same result. Sync engines connect the store to IndexedDB, other tabs, or a server.

## Quick start

Start with a schema and a store.

```sh
npm install @goodstate/store @goodstate/schema
```

```ts
import { array, object, string } from "@goodstate/schema";
import { Store } from "@goodstate/store";

const schema = object({ todos: array(object({ id: string(), title: string() })) });

const store = new Store(schema);

store.onChange(() => console.log(store.query((state) => state.todos)));

store.mutate((draft) => {
	draft.todos.push({ id: "1", title: "Write README" });
});
```

Adopt the rest one package at a time. Add React hooks, persistence on the device, and sync with a server when you need them. `createStore` creates the same store and returns hooks bound to it.

```sh
npm install @goodstate/react @goodstate/indexdb-sync @goodstate/sse-sync
```

```ts
import { IndexDbSync } from "@goodstate/indexdb-sync";
import { createStore } from "@goodstate/react";
import { array, object, string } from "@goodstate/schema";
import { SseSync } from "@goodstate/sse-sync";

const schema = object({ todos: array(object({ id: string(), title: string() })) });

export const { store, useQuery, useMutation } = createStore(schema);

const persistence = new IndexDbSync(store);
const remote = new SseSync(store, new URL("https://example.com/sync"));

remote.onError((error) => console.error(error));

persistence.connect();
remote.connect();
```

`IndexDbSync` saves the state on the device and `SseSync` syncs it with a server. Use either one or both. For small state, [`@goodstate/local-storage-sync`](packages/local-storage-sync) saves it to `localStorage` and shares it between tabs in one engine.

> [!NOTE]
> Engines start idle, so you can add listeners before calling `connect()`.

## How it works

The store carries all state on board, like a spacecraft that keeps flying without the ground. Sync engines open links to the outside and merge whatever comes back.

## Examples

- [`examples/react`](examples/react) is a kanban board that works offline, syncs between tabs, and merges edits from other devices through a server.
- [`examples/server`](examples/server) is the sync server the board and the Node examples connect to.
- [`examples/node`](examples/node) watches this repository for `TODO` comments and adds them to the board as tickets over server-sent events.
- [`examples/schema`](examples/schema) holds the schema both apps share.
