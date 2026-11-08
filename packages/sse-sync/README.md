# @nn/sse-sync

Sync engine that keeps a store in sync with a server over [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

## Installation

```sh
npm install @nn/sse-sync @nn/store
```

## Usage

```ts
import { SseSync } from "@nn/sse-sync";

const sync = new SseSync(store, new URL("https://example.com/sync"));

sync.onError((error) => console.error(error));
sync.connect();
```

### Server endpoints

The engine talks to two endpoints under the URL you pass:

- `GET /sync/subscribe` streams server-sent events. Each event's data is a JSON object of encoded entries keyed by state property name.
- `POST /sync/push` receives a JSON object with one changed entry keyed by its property name.
