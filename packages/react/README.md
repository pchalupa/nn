# @goodstate/react

[React](https://react.dev/) hooks for reading and updating a store.

## Installation

```sh
npm install @goodstate/react @goodstate/schema
```

## Usage

`createStore` creates a store for a schema and returns hooks bound to it.

```tsx
import { createStore } from "@goodstate/react";
import { array, object, string } from "@goodstate/schema";

const schema = object({ todos: array(object({ id: string(), title: string() })) });

export const { store, useQuery, useMutation } = createStore(schema);

function TodoCount() {
	const count = useQuery((data) => data.todos.length);
	const mutate = useMutation();

	return (
		<button onClick={() => mutate((draft) => void draft.todos.push({ id: crypto.randomUUID(), title: "New" }))}>
			{count}
		</button>
	);
}
```

`useQuery` re-renders only when the selected value changes. Pass `store` to a sync engine to persist or share the state.
