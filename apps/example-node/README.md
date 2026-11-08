# example-node

Node.js script that watches this repository for `TODO` comments and adds them to the board as tickets. It uses `@nn/store` and `@nn/sse-sync`.

## Running

Start the `example-react` sync server first, then run:

```sh
pnpm install
pnpm --filter example-node dev
```

## Configuration

| Variable     | Default                      | Description            |
| ------------ | ---------------------------- | ---------------------- |
| `REMOTE_URL` | `http://localhost:3001/sync` | URL of the sync server |
| `LOG_LEVEL`  | `info`                       | Log level              |
