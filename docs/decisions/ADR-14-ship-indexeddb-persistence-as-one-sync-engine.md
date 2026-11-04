---
author: Petr Chalupa
date: 2026-11-03
---

# ADR-14: Ship IndexedDB persistence as one sync engine

Amends [ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md).

Amended by [ADR-16](ADR-16-give-sync-engines-a-connection-lifecycle.md): `IndexDbSync` reconnects when the database closes or fails to open, and `IndexDb` reports a closed database to its delegate.

## Context

[ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md) moved persistence out of `Store` into sync engines that extend [`SyncEngine`](../../packages/sync-engine/src/sync-engine.ts). It kept persistence in three packages, to mirror the existing split of abstraction and adapter packages. [`@nn/repository`](https://github.com/pchalupa/nn/blob/a67280fad54b78ae8c03d6c6608819e166f47ce2/packages/repository/src/Repository.ts) held the `Repository` interface, its `Entry` type and two error classes. `@nn/indexdb-repository` held `IndexDbRepository`, the [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) implementation. [`@nn/repository-sync`](https://github.com/pchalupa/nn/blob/a67280fad54b78ae8c03d6c6608819e166f47ce2/packages/repository-sync/src/RepositorySync.ts) held `RepositorySync`, the engine.

`IndexDbRepository` is the only `Repository` implementation. `RepositorySync` maps each of its four hooks to one repository method: `open()` to `init()`, `close()` to `close()`, `pull()` to `get()` and `push()` to `set()`. `Entry` has the same shape as `Encoded` from [`@nn/entities`](../../packages/entities/src/codable.ts). An app that persists to IndexedDB installs two packages and wires them together with `RepositorySync.attach(store, new IndexDbRepository(name))`.

[`@nn/broadcast-sync`](../../packages/broadcast-sync/src/broadcast-sync.ts), the second engine, keeps its transport inside the engine and ships as one package. ADR-13 already names `SyncEngine` as the class a third party writes an engine against.

## Decision

We will ship IndexedDB persistence as one package, `@nn/indexdb-sync`, which exports only [`IndexDbSync`](../../packages/indexdb-sync/src/index-db-sync.ts). An app attaches it with `IndexDbSync.attach(store, name)`. `name` is the database name and defaults to `"nn-default"`. The constructor is private, as in `BroadcastSync`.

`IndexDbRepository` stays as a class inside the package, renamed to [`IndexDb`](../../packages/indexdb-sync/src/index-db.ts). `IndexDbSync` creates it in its constructor and calls it from each hook. The package doesn't export it, so its methods can change without a major release. It works with `Encoded` instead of `Entry`, and it throws a plain `Error` instead of `RepositoryNotInitializedError` when it is used before `init()`.

We will remove `@nn/repository`, `@nn/indexdb-repository` and `@nn/repository-sync`. The database name, the object stores and the stored values stay the same, so data saved by `RepositorySync` restores with `IndexDbSync`.

This amends one point of ADR-13: an engine and its storage adapter ship together, as one package per transport. ADR-13's rule of one package per engine still holds.

## Alternatives considered

**Keep the three packages from ADR-13.** Each package would stay small, and another storage backend could implement `Repository` without touching the engine. We rejected it because `Repository` has one implementation and `RepositorySync` only forwards calls to it. The interface is a second extension point next to `SyncEngine`, and every app pays for it by installing and wiring two packages.

**Keep `Repository` as a public interface, in `@nn/indexdb-sync` or `@nn/sync-engine`.** It would let a SQLite backend plug in without writing an engine. We rejected it because no second backend exists. An engine on top of `SyncEngine` is about 30 lines, and `SyncEngine` already owns the ordering and failure rules that are easy to get wrong.

**Move the IndexedDB code into `IndexDbSync` and remove `IndexDb`.** It removes a class that only `IndexDbSync` calls. We rejected it because the IndexedDB work (opening the database, version upgrades, aborting a write that a newer write replaces) is a different job from the engine lifecycle. Keeping it in its own class keeps that file's history and lets its tests drive it directly.

## Consequences

This is a breaking change for apps that use the removed packages. They install `@nn/indexdb-sync` and replace `RepositorySync.attach(store, new IndexDbRepository(name))` with `IndexDbSync.attach(store, name)`. Their stored data doesn't need a migration.

The removed packages get no further releases. Changesets can't release a package that no longer exists, so we deprecate them on npm by hand after `@nn/indexdb-sync` is published.

A new storage backend is now a new engine package, not a `Repository` implementation. If two backends later share enough code to need a common interface, we add it then, inside the packages that need it.

`IndexDb` keeps `delete` and `getAll`, which `IndexDbSync` doesn't call. Only its tests use them until an engine needs them.

`IndexDbSync.test.ts` now runs against [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) instead of a `Repository` mock, so the engine tests also cover the IndexedDB behavior they depend on.
