---
"@nn/store": minor
---

Adds `State`, which holds the store's entities and reports changes to a single `StateDelegate`. `stateDidChange(state, changed)` receives the changed top-level entities as a `ReadonlySet<Entity>`; each entity's `key` is its field name.

```ts
state.delegate = {
	stateDidChange: (state, changed) => {
		for (const entity of changed) persist(entity.key, entity);
	},
};
```

`State` takes only the schema. `update` and `merge(name, entity)` each publish a single notification, however many fields change. `merge` ignores an unknown field name and an entity whose key does not match the field.

`update` does not validate the draft. A list or object field set to a value of the wrong type is left unchanged, scalar fields take whatever value is assigned, and new rows fill missing fields with their schema defaults. An error thrown while the draft is applied keeps the edits already applied and still publishes them.
