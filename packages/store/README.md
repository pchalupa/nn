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
