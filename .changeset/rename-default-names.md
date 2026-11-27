---
"@goodstate/indexdb-sync": major
"@goodstate/broadcast-sync": major
---

The default database and channel name is now `goodstate-default` instead of `nn-default`. If you construct an engine without a name and want to keep reading the data already on the device, pass the old name: `new IndexDbSync(store, "nn-default")` and `new BroadcastSync(store, "nn-default")`.
