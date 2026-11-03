---
"@nn/http-sync": major
---

Adds `HttpSync`, a sync engine that keeps a store in sync with a server over HTTP. The server exposes `GET /pull`, which returns every stored field, `POST /push`, which takes the changed fields, and `GET /subscribe`, a [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) stream that announces each update.

Attach it with `HttpSync.attach(store, url)`. The engine opens the event stream, merges the server's fields into the store, and then pushes each field that changes. When the server announces an update, or the stream reconnects, it pulls again and merges. Call `sync.detach()` to stop syncing and close the stream.

```ts
import { HttpSync } from "@nn/http-sync";
import { IndexDbRepository } from "@nn/indexdb-repository";
import { RepositorySync } from "@nn/repository-sync";

RepositorySync.attach(store, new IndexDbRepository("settings"));
HttpSync.attach(store, "https://example.com/api");
```

Endpoints resolve under the URL's path, so `https://example.com/api` pulls from `https://example.com/api/pull`. The URL must be absolute; a relative or invalid URL detaches the engine.

`HttpSync` doesn't queue writes. A failed push is reported to `delegate.syncEngineDidFailToPush` and dropped, so an edit made while the server is unreachable reaches it only when that field changes again. The server is expected to store each field as it arrives; merging happens in the clients. If the server can't be reached when the engine attaches, the engine detaches and the store keeps working locally.
