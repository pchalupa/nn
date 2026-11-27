# @goodstate/store

Schema-typed state container that merges concurrent changes without conflicts.

## Installation

```sh
npm install @goodstate/store @goodstate/schema
```

## Usage

```ts
import { array, object, string } from "@goodstate/schema";
import { Store } from "@goodstate/store";

const store = new Store(object({ todos: array(object({ id: string(), title: string() })) }));

store.mutate((draft) => {
	draft.todos.push({ id: "1", title: "Write README" });
});

store.query((state) => state.todos);
```

`query` runs the selector once and returns its result. To read again after a change, call it from an `onChange` listener.

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

for (const [name, entry] of Object.entries(fromSecond)) first.merge(name, entry);
for (const [name, entry] of Object.entries(fromFirst)) second.merge(name, entry);
```

When both replicas write the same value, the later write wins. Arrays merge as a union keyed by item. An item one replica added appears on both, but an item one replica removed comes back when a replica that still holds it merges, and the order of items can differ between replicas. When replicas use different schemas, fields the local schema doesn't declare are dropped, a value that changed between an object, an array and a single value keeps its local value, and array items that changed the same way are skipped.

To keep a store in sync continuously, use a sync engine such as [`@goodstate/broadcast-sync`](https://github.com/pchalupa/goodstate/tree/main/packages/broadcast-sync) or [`@goodstate/sse-sync`](https://github.com/pchalupa/goodstate/tree/main/packages/sse-sync), or extend [`@goodstate/sync-engine`](https://github.com/pchalupa/goodstate/tree/main/packages/sync-engine).
