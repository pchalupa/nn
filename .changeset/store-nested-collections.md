---
"@nn/store": major
---

Builds a store's entities from the whole schema tree, so an array is a collection wherever it is declared, not only at the top level.

A root can now be any declared shape. `object` roots build a map of field entities, `number` and `boolean` roots build a register, and `array(string())` builds a collection of registers. Before, only `array(object(...))` and `string()` were accepted and every other root threw a `TypeError`.

```ts
const store = await createStore({
	schema: object({
		board: object({
			title: string(),
			tickets: array(object({ title: string(), tags: array(string()) })),
		}),
	}),
});

store.read(["board", "tickets", "1", "tags"]);
store.update(["board", "tickets", "1", "tags"], (tags) => {
	tags.push("urgent");
});
```

An array field is no longer one register holding the whole array. Each item gets its own entity: a row of object items is an `LWWMap` keyed like a top-level row, and a scalar item is an `LWWRegister`. Two replicas that edit different items of the same array keep both edits instead of one array value winning.

Paths follow the same rule at every level, so a nested row is addressed by its key and a nested field path can be as deep as the schema. A scalar collection still ends a path, because its items have no key the caller can name.

Three consequences to plan for:

- An array field persists as a collection entry instead of a register entry. Stored data written before this change resets that root to its schema default on first load, as the tree persistence change already describes.
- Writing a row that omits an array field clears that collection to `[]`. It used to leave the field `undefined`.
- Reordering a scalar collection rewrites its items in place, because `RGA` has no ordering yet. Adding an item at the front keeps the same item entities and shifts their values, so the read is correct but the timestamps are not the ones a real insert would produce. A keyed collection still rejects a move with `StoreError.unsupported`.

A row schema still cannot declare `key`, and the check now runs over the whole schema tree instead of the top level only.
