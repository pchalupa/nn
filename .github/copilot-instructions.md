# Copilot Instructions

Purpose: Help AI agents make productive, safe changes quickly—focus on THIS repo's architecture and conventions (skip generic style advice).

## Architecture Snapshot
Monorepo (pnpm workspaces, Node >=22). Core packages under `packages/` compose a reactive, persistent state layer with optional remote sync:
- `@nn/event-emitter`: Tiny typed emitter (`emit/on/once/off`). Stable API—changing it is a breaking cascade.
- `@nn/time`: Hybrid Logical Clock (`Time.now()` monotonic + logical counter) used for conflict resolution.
- `@nn/entities`: CRDT-flavored Last-Writer-Wins primitives (`LWWRegister`, `LWWMap`) relying on `Time` for merges.
- `@nn/schema`: `Collection<T>` with `events.emit('update', value)` on mutation; factory `collection()` used to declare schema entries.
- `@nn/repository`: Interfaces (`Repository`, `RepositoryFactory`) abstract persistence (`set`, `getAll`).
- `@nn/indexdb-repository`: Browser IndexedDB implementation with auto upgrade (recursively re-open if stores missing).
- `@nn/remote` + `@nn/http-remote`: Remote sync abstraction and HTTP/SSE implementation (`pull`, `push`, `subscribe`). Emits `update` to trigger store invalidation.
- `@nn/store`: Orchestrates state object (collections), listens for entity updates, persists via repository, produces snapshot proxies.
- `@nn/react`: Async `createStore` (loads persisted data first) + `use(storePromise)` hook integrating with React 19 `use` and `useSyncExternalStore` for fine-grained subscription.
Example integrations live in `apps/example-react` (client) and `apps/example-server` (Express + SSE endpoints expectation: `/pull`, `/push`, `/subscribe`).

## Data & Reactivity Flow
1. App defines schema: `{ tickets: collection<Ticket>(), ... }` passed to `createStore`.
2. (Optional) Repository factory loads existing per-type data before `Store` constructed.
3. Collections emit `update` on `push`; `Store` writes back via `repository.set(id, value, typeName)`.
4. `Store.getSnapshotOf(selector)` caches a proxy Snapshot keyed by selector function reference; invalidation triggers global `store.events.update`.
5. React hook obtains snapshot id via `getSnapshot` to detect changes; stable selector identity is required for caching.
6. Remote implementation can emit `update` to signal external changes (pull/push extension point).

## Conventions
- Always import via `@nn/*` aliases; avoid deep relative paths between packages.
- New domain sets: add to schema; do not mutate store shape after creation.
- Repository creation MUST be async and side-effect free beyond schema prep; return an object implementing `set/getAll` only.
- Use `Time` exclusively for ordering in CRDT merges—never mix with raw Date logic inside entities.
- Snapshot / Reference proxies must not expose additional enumerable fields; extend via methods on underlying classes if needed.
- Tests colocated with source (`*.test.ts/tsx`); ensure additions keep test runtime fast (IndexedDB: use `fake-indexeddb`).

## Key Commands
Root:
- Install deps: `pnpm install`
- Dev all: `pnpm dev`
- Type check: `pnpm ts:check`
- Lint / Format: `pnpm lint` / `pnpm format`
- Spellcheck: `pnpm spellcheck`
- Tests: `pnpm test` | watch `pnpm test:watch` | coverage `pnpm test:coverage`
Target app/server:
- React app: `pnpm --filter example-react dev` (needs `VITE_REMOTE_URL`).
- Server: `pnpm --filter example-server dev`.

## Extension Points & Gotchas
- Adding persistence: implement `Repository`; ensure `createRepository(typeNames)` prepares ALL object stores before resolving.
- Adding remote transport: implement `Remote`; emit `update` to integrate with existing invalidation.
- New CRDT: implement `Mergeable.merge(remote)` returning deterministic, idempotent result; rely on `Time` for tie-breaks.
- Changing selector lambdas inline in components breaks snapshot caching; keep them stable or memoize.
- IndexedDB upgrade path relies on recursion when a store is missing—preserve this pattern when altering type names.

## Minimal Usage Example
```ts
const store = await createStore({
	schema: { tickets: collection<Ticket>() },
	repository: IndexDbRepository,
	remote: new HttpRemote(url)
});
const useStore = use(store);
function Tickets() { const tickets = useStore(s => s.tickets); }
```

## PR Guidance (For Agents)
- Keep changes scoped; update dependent packages in the same PR when touching shared interfaces.
- Add/adjust tests alongside changed files; prefer unit tests over broad integration unless required.
- Before refactors to shared primitives (EventEmitter, Time, Store), search for usages across all packages.

Questions / missing context? Ask for remote sync strategy or desired CRDT semantics expansion.
