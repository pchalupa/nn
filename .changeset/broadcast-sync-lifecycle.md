---
"@nn/broadcast-sync": major
---

`BroadcastSync` announces a newly attached store's state to the stores already on its channel. Every field is sent when the store attaches, so a store that was edited before it attached (for example a language set before `BroadcastSync.attach(store, name)`) reaches the other tabs on the channel, not only the changes made afterwards.

`BroadcastSync.attach(store, name)` returns the engine right away instead of a promise and opens the channel in the background. Remove the `await` in front of the call:

```ts
// before
const sync = await BroadcastSync.attach(store, "settings");

// after
const sync = BroadcastSync.attach(store, "settings");
```

The delegate follows `@nn/sync-engine`: rename `syncEngineDidFailToPush` to `syncEngineDidFail`, as described in the `@nn/sync-engine` release notes.

Stop syncing with `sync.session.detach()` instead of `sync.detach()`.
