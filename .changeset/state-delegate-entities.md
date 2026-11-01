---
"@nn/store": major
---

`StateDelegate.stateDidChange` now receives the changed entries as a `ReadonlyMap` from entry name to live root entity, instead of a `ReadonlySet` of names. `State.entity(name)` is removed. Read changed entities from the delegate payload instead.

```ts
state.delegate = {
	stateDidChange: (state, changed) => {
		for (const name of changed) persist(name, state.entity(name)); // before
		for (const [name, entity] of changed) persist(name, entity); // after
	},
};
```

`State.merge(name, remote)` now ignores an unknown entry name instead of throwing a `TypeError`. `State.update` applies the draft in a single pass, so an error thrown while applying it, for example by key generation, keeps the edits already applied and still publishes them. `update` also no longer validates the draft: it does not throw "Store state does not match its schema." Instead, a list or object field holding a value of the wrong type is left unchanged, and newly created rows fill missing fields with their schema defaults.
