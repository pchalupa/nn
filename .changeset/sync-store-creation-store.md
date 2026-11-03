---
"@nn/store": major
---

Creates a `Store` synchronously from a schema and attaches persistence from outside it.

`Store.fromSchema()` is removed, and the constructor takes only the schema. `Store` no longer accepts a repository or a remote, so it no longer restores or persists anything by itself. `RepositorySync`, exported from `@nn/store/RepositorySync`, does that work. Attach it with `RepositorySync.attach(store, repository)`, which returns a `Sync`. The returned value implements the new `Sync` interface from `@nn/store/Sync`, which has a `restored` promise that settles when the initial restore finishes and a `detach()` method.

```ts
// Before
const store = await Store.fromSchema({ schema, repository });

// After
const store = new Store(schema);
const sync = RepositorySync.attach(store, repository);
```

The store is usable at once with the schema defaults, and stored values merge in when the restore finishes. Await `sync.restored` if you need the restored state. It rejects when the restore fails, and each failure is also logged with `console.error`. `RepositorySync` persists only changes reported after it attaches. Each store needs its own repository: records are keyed by field name, so two stores sharing one database would overwrite each other's fields. Give each `IndexDbRepository` its own database name, for example `new IndexDbRepository("settings")`. After an `init` failure the adapter persists nothing for its lifetime, and a field that failed to restore is never written by that adapter.

`Store` also exposes the `schema` it was built from, and `observe(observer)`, which calls the observer with the set of changed entities on every commit and returns an unsubscribe function. `subscribe` is unchanged.
