---
author: Petr Chalupa
date: 2026-11-02
---

# ADR-13: Attach persistence and sync from outside the store

## Context

[`Store`](../../packages/store/src/Store.ts) used to receive a [`Repository`](../../packages/repository/src/Repository.ts) and a [`Remote`](../../packages/remote/src/Remote.ts) in its constructor. It encoded every changed entity into the repository, and the static `Store.fromSchema` restored the stored fields before it returned. That made creation async. [`@nn/react`](../../packages/react/src/index.ts) re-exported it as `createStore`, so `use()` had to take a `Promise<Store>` and suspend on it. The `remote` parameter was never used.

Remote sync is the next piece of work. If `Store` owned it, `Store` would also have to order persistence, the network and their restores. The ordering is already delicate. [`IndexDbRepository`](../../packages/index-db-repository/src/IndexDbRepository.ts) throws on `set` until `init` has finished, and a write that lands before the restore reads a field overwrites the stored value with what the user typed in the meantime.

[ADR-12](ADR-12-report-changes-to-a-single-delegate.md) makes `Store` the single delegate of `State` and says `State` listeners get no arguments, because React only needs to know when to read the snapshot again. A persistence or sync adapter needs to know which entities changed, and adapters come and go, so they can't share one delegate slot. The [design spec](../notes/plans/sync-store-creation.md) has the full background.

`Repository` and `Remote` do different jobs. A repository is passive per-field storage with `init`, `get` and `set`. A remote pushes updates, connects and disconnects, and can be offline.

## Decision

We will take the repository and the remote out of `Store`. The constructor is `new Store(schema)`, it is synchronous, and `Store.fromSchema` is removed. `Store` holds the state, applies updates and merges, and reports what changed. It exposes the `schema` it was built from, so an adapter doesn't need it passed separately.

Persistence and sync are adapters that attach to a store from outside. Each returns the `Sync` interface from [`@nn/sync`](../../packages/sync/src/Sync.ts): a `restored` promise that settles when the initial restore finishes, and a `detach()` method. [`RepositorySync`](../../packages/repository-sync/src/RepositorySync.ts) is the first adapter. `RepositorySync.attach(store, repository)` creates it, starts it and returns the `Sync`; the constructor is private, so an adapter can't exist without being attached. It restores in the background and persists the changes reported after it attaches. An adapter belongs to one store for its whole life. An app with several stores attaches one adapter per store, and nothing is re-attached, so we don't separate the adapter from its attachment. A remote that goes offline stays attached and reconnects inside the adapter, because edits made while offline still have to be recorded. A remote adapter will follow the same shape, and we will extract a shared base class only when the duplication between the two is real.

We will keep `Repository` and `Remote` as separate interfaces. One transport interface would fit neither of them well.

We will ship each sync engine as its own package, and the `Sync` interface in `@nn/sync`. `RepositorySync` lives in `@nn/repository-sync`, and a remote engine will get its own package. `Store` never refers to `Sync`, so an engine depends on the store and never the other way round. An app that doesn't sync installs no sync code, and a third party can write an engine against `@nn/sync` alone. This mirrors the repository's existing split of abstraction and adapter packages, such as `@nn/repository` and `@nn/indexdb-repository`. `@nn/react` provides `createStore(schema)`, which wraps `new Store(schema)`, so a React app installs `@nn/react` and the engines it uses, not `@nn/store` directly.

We will add `Store.observe(observer)`, which calls the observer with the `ReadonlySet<Entity>` of changed entities on every commit and returns an unsubscribe function. Observers run before the no-argument `subscribe` listeners, so an adapter starts persisting before React reads. This amends ADR-12 on one point: its "listeners get no arguments" rule still holds for `subscribe`, and `observe` is the second channel for observers that need the changed entities. `State` still has `Store` as its single delegate.

## Alternatives considered

**Keep `Store` as the hub for the repository and the remote.** The constructor stays as it was and `Store` coordinates the adapters. We rejected it because every new adapter would add code and ordering rules to `Store`, and creation would stay async while it restores.

**A typed list of adapters that `Store` calls into.** `Store` would accept `adapters: Sync[]` and call `restore` and `persist` hooks on them. We rejected it because `Store` would still own the ordering and the failure rules, only under a different name.

**One shared transport interface for `Repository` and `Remote`.** It would let a single adapter class serve both. We rejected it because the two have different life cycles. A repository has no connection and never pushes, while a remote connects, pushes and goes offline.

**Attach by constructing the adapter, `new RepositorySync(store, repository)`.** This is how Yjs providers work. We rejected it because the object exists only for its side effect, so lint's `no-new` rule pushes every app to keep or export a value it doesn't need.

**Separate the adapter from its attachment, `adapter.attach(store)` returning a handle, or `store.attach(adapter)`.** It would let one adapter move between stores, and it matches `Remote.connect()`. We rejected it because stores are not swapped at runtime, so the second object buys nothing. `store.attach` would also put `Store` back in charge of its adapters.

**Keep `Sync` and `RepositorySync` in `@nn/store`, or put every engine in one `@nn/sync` package.** Either means fewer packages to version. We rejected the first because the store would carry code most of its consumers don't use and would point the dependency the wrong way. We rejected the second because it ties every engine's release and transport dependencies together, and an outside engine author would still depend on all of them.

**Pass the changed entities to `subscribe` listeners.** It would avoid a second channel. We rejected it because it changes every React listener's signature for data React doesn't use, and it reverses the ADR-12 decision instead of narrowing it.

## Consequences

This is a breaking change for `@nn/store` and `@nn/react`, and each gets a major changeset. `@nn/sync` and `@nn/repository-sync` are new packages. `Store.fromSchema` is removed, `createStore` takes only the schema and returns the store synchronously, and `use()` takes a `Store`. Code that passed a repository to the store now installs `@nn/repository-sync` and calls `RepositorySync.attach(store, repository)` next to it.

The store is usable with the schema defaults as soon as it exists. Components render those defaults and update when the restore merges in. We accept that there is no suspense on the restore for now. Callers that need the restored state await `sync.restored`, and we can layer a suspense mode on it later.

`RepositorySync` persists only changes reported after it attaches. An edit made before that, or while it is detached, is saved only if the same field changes again. A restore failure leaves the failed field unwritten, so stored data that was never merged isn't overwritten. The details are in the spec and in `RepositorySync.test.ts`.

`observe` observers run synchronously inside the commit, in the order they were added. A slow or throwing observer delays or breaks the listeners after it, so adapters must handle their own errors. `RepositorySync` reports them with `console.error`.

A remote adapter can now be added without changing `Store`. The restore ordering and per-field failure handling will probably repeat there, and we will extract a base class at that point.
