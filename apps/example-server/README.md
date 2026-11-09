# example-server

Sync server for the examples. `example-react`, `example-node` and `example-agent` push changes to it and receive everyone else's over server-sent events. It uses Hono.

## Running

```sh
pnpm install
pnpm --filter example-server dev
```

This starts the server on http://localhost:3001. The local server keeps data in memory, so it resets on restart.

## Deployment

The `nn-example-server` Vercel project deploys `api/sync.ts` with Root Directory set to `apps/example-server`. It keeps data in Upstash Redis. Production uses the `nn-example` key and channel, and every preview deployment shares `nn-example-preview`.

## Configuration

| Variable | Default | Description                |
| -------- | ------- | -------------------------- |
| `PORT`   | `3001`  | Port the local server uses |
