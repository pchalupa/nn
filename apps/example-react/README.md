# example-react

Kanban board that works offline, syncs between tabs, and merges edits from other devices through a server. It uses `@nn/react`, `@nn/indexdb-sync`, `@nn/broadcast-sync` and `@nn/sse-sync`.

## Running

```sh
pnpm install
pnpm --filter example-react dev
```

This starts the board on http://localhost:3000 and a sync server on http://localhost:3001. The local server keeps data in memory, so it resets on restart.

## Configuration

| Variable          | Default                      | Description                     |
| ----------------- | ---------------------------- | ------------------------------- |
| `VITE_REMOTE_URL` | `http://localhost:3001/sync` | URL of the sync server          |
| `PORT`            | `3001`                       | Port the local sync server uses |
| `LOG_LEVEL`       | `info`                       | Log level of the sync server    |
