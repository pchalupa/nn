# @nn/react

[React](https://react.dev/) hooks for reading and updating a store.

## Installation

```sh
npm install @nn/react @nn/schema
```

## Usage

`createStore` creates a store for a schema and returns hooks bound to it.

```tsx
import { createStore } from "@nn/react";
import { array, object, string } from "@nn/schema";

export const { store, useRead, useUpdate } = createStore(
	object({ todos: array(object({ id: string(), title: string() })) }),
);

function TodoCount() {
	const count = useRead((data) => data.todos.length);
	const update = useUpdate();

	return (
		<button onClick={() => update((draft) => void draft.todos.push({ id: crypto.randomUUID(), title: "New" }))}>
			{count}
		</button>
	);
}
```

`useRead` re-renders only when the selected value changes. Pass `store` to a sync engine to persist or share the state.
