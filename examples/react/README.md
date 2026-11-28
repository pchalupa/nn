# example-react

Kanban board that works offline, syncs between tabs, and merges edits from other devices through a server. It uses `@goodstate/react`, `@goodstate/indexdb-sync`, `@goodstate/broadcast-sync` and `@goodstate/sse-sync`.

## Running

```sh
pnpm install
pnpm --filter example-react --filter example-server dev
```

This starts the board on http://localhost:3000 and the [`example-server`](../example-server) sync server on http://localhost:3001.

## Configuration

| Variable          | Default                      | Description            |
| ----------------- | ---------------------------- | ---------------------- |
| `VITE_REMOTE_URL` | `http://localhost:3001/sync` | URL of the sync server |
