---
"@nn/indexdb-sync": major
---

`IndexDbSync.attach(store, name)` returns the engine right away and loads the stored state in the background, so the app doesn't wait for IndexedDB before it renders. The store shows its default values until the stored state merges in. Edits made in the meantime merge with it and are written once the database opens.

Remove the `await` in front of the call. Code that keeps it still compiles, but it no longer waits for the stored state.

```ts
// before
const sync = await IndexDbSync.attach(store, "settings");

// after
const sync = IndexDbSync.attach(store, "settings");
```

A failure to open or read the database is reported through `syncEngineDidFail` on `sync.delegate`.

Stop syncing with `sync.session.detach()` instead of `sync.detach()`.
