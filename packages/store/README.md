# @nn/store

Schema-typed state container that merges concurrent changes without conflicts.

## Installation

```sh
npm install @nn/store @nn/schema
```

## Usage

```ts
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";

const store = new Store(
	object({ todos: array(object({ id: string(), title: string() })) }),
);

store.update((draft) => {
	draft.todos.push({ id: "1", title: "Write README" });
});

store.read().todos;
```

### Listening for changes

`onChange` receives the encoded entries that changed and returns a function that stops listening.

```ts
const unsubscribe = store.onChange((changes) => {
	console.log(Object.keys(changes));
});

unsubscribe();
```

### Merging replicas

Each store that uses the same schema is a replica. `encode()` returns the whole state as one entry per top-level property under `data`, and `merge(name, entry)` merges one of those entries into another replica. Entries are plain JSON, so they can be sent over any transport. To bring two replicas up to date with each other, merge each one's entries into the other:

```ts
const fromFirst = first.encode().data;
const fromSecond = second.encode().data;

for (const [name, entry] of Object.entries(fromSecond))
	first.merge(name, entry);
for (const [name, entry] of Object.entries(fromFirst))
	second.merge(name, entry);
```

When both replicas write the same value, the later write wins. Arrays merge as a union keyed by item. An item one replica added appears on both, but an item one replica removed comes back when a replica that still holds it merges, and the order of items can differ between replicas.

To keep a store in sync continuously, use a sync engine such as [`@nn/broadcast-sync`](https://github.com/pchalupa/nn/tree/main/packages/broadcast-sync) or [`@nn/sse-sync`](https://github.com/pchalupa/nn/tree/main/packages/sse-sync), or extend [`@nn/sync-engine`](https://github.com/pchalupa/nn/tree/main/packages/sync-engine).
