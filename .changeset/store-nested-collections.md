---
"@nn/store": major
---

Builds a store's entities from the whole schema tree. An object becomes an `LWWMap` of field entities, an array becomes an `RGA` wherever it is declared, and a string, number or boolean becomes an `LWWRegister`. Any of them can be a top-level field.

```ts
const store = await createStore({
	schema: object({
		board: object({
			title: string(),
			tickets: array(object({ title: string(), tags: array(string()) })),
		}),
	}),
});

store.state.update((draft) => {
	draft.board.tickets[0].tags.push("urgent");
});
```

Each array item gets its own entity, so two replicas that edit different items of the same array keep both edits instead of one array value winning. Object rows are matched to their entities by identity. Scalar items are matched by position, so inserting at the front of a scalar array rewrites each item's value instead of inserting one.
