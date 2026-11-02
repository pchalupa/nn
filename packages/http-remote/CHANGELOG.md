# @nn/http-remote

## 1.0.0

### Major Changes

- 8fcddf4: A remote reports updates to a single `delegate` implementing `RemoteDelegate.remoteDidUpdate(remote)`. `subscribe()` is renamed `connect()` and still returns the function that closes the connection. `HttpRemote.events` is removed.

  ```ts
  remote.events.on("update", () => {}); // before
  remote.subscribe();

  remote.delegate = { remoteDidUpdate(remote) {} }; // after
  remote.connect();
  ```

### Patch Changes

- Updated dependencies [8fcddf4]
- Updated dependencies [8fcddf4]
  - @nn/remote@1.0.0
