---
"@nn/sync-engine": major
---

`SyncEngine` syncs any object that matches the new `Replica` interface, exported from `@nn/sync-engine/replica`, instead of requiring a `Store`, so the package no longer depends on `@nn/store` or `@nn/entities`. A `Store` already matches `Replica`, so `new MySync(store)` works as before.

Subclasses read the synced object from `this.replica` instead of `this.store`. `push(name, entry)` now types `entry` as `unknown`, because the engine treats entries as opaque. An override that still declares `entry: Encoded` keeps compiling.

```ts
// Before
protected async open(): Promise<void> {
	await this.connection.subscribe(Object.keys(this.store.schema.properties));
}

// After
protected async open(): Promise<void> {
	await this.connection.subscribe(Object.keys(this.replica.schema.properties));
}
```
