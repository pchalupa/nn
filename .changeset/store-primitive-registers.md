---
"@nn/store": minor
---

Maps a top-level `string` property of the store schema to an `LWWRegister`, instead of throwing a `TypeError`.

Use it for a single value, like the selected language:

```ts
const store = await Store.fromSchema({
	schema: object({
		tickets: array(ticket),
		language: string(),
	}),
	repository,
});

store.getSnapshotOf((state) => state.language).current = "cs";
```

A register has no `id`, so the repository keeps it as a single record keyed by the property name, read back with `Repository.get` and written on every change. A register with no stored value starts as `undefined`, which is why the property is typed `LWWRegister<string | undefined>`.

A top-level `object`, `number` or `boolean` still throws.
