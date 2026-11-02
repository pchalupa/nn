---
"@nn/remote": major
"@nn/http-remote": major
---

A remote reports updates to a single `delegate` implementing `RemoteDelegate.remoteDidUpdate(remote)`. `subscribe()` is renamed `connect()` and still returns the function that closes the connection. `HttpRemote.events` is removed.

```ts
remote.events.on("update", () => {}); // before
remote.subscribe();

remote.delegate = { remoteDidUpdate(remote) {} }; // after
remote.connect();
```
