# Incremental hexagonal architecture

Status: direction approved in conversation on 2026-10-05; written specification approved on 2026-10-06. Import restrictions and callback-based remote subscriptions were implemented on 2026-10-06 under the [selected quick-wins plan](../plans/2026-10-06-hexagonal-imports-and-remote-subscription.md).

## Goal and agreed approach

The same application behavior must run with React, IndexedDB and HTTP, and with a headless driver, in-memory storage and deterministic clocks. Core behavior must be testable independently of those technologies.

We will strengthen boundaries within the existing packages. The user approved incremental responsibility extraction, explicit replica dependencies, clearer persistence and remote contracts, and a thin React adapter. This document records that direction and defines the first implementation slice. Later slices have their own design and implementation reviews before their public contracts change.

The first slice separates state construction from loading and makes store creation available directly from `@nn/store`. It preserves the path-scoped read/update API and existing value storage. Subsequent slices address replica ownership, repository semantics, deferred root persistence and synchronization in that order.

## Current code and existing decisions

The working tree already has useful boundaries:

- [`Repository`](../../../packages/repository/src/Repository.ts) and [`Remote`](../../../packages/remote/src/Remote.ts) are technology-independent contracts.
- [`IndexDbRepository`](../../../packages/index-db-repository/src/IndexDbRepository.ts) and [`HttpRemote`](../../../packages/http-remote/src/HttpRemote.ts) implement concrete adapters.
- [`Store`](../../../packages/store/src/Store.ts) imports those contracts rather than the adapters.
- [`View`](../../../packages/store/src/View.ts), drafts, diffing and patch application already have separate modules.

The current gaps are behavioral:

- `State.fromSchema` initializes and reads storage while constructing and validating entities.
- `@nn/react` owns the `createStore` convenience export even though `Store.fromSchema` already supports headless construction.
- Entities generate IDs implicitly; `Time` reads physical time and owns a process-wide clock and replica identity.
- Store listeners start repository writes without an observable completion boundary.
- `Remote.subscribe` accepts no listener. HTTP notifications are exposed through an extra adapter-specific event emitter.

These observations describe the working tree inspected on 2026-10-05. Some historical ADRs describe functionality that has since been reverted. Current code and the explicit deferral notes determine the starting point.

The [path-scoped store design](2026-10-02-path-scoped-store-design.md) remains the source for read, update and reference-stability behavior. [ADR-09](../../decisions/ADR-09-stamp-times-with-a-replica-identity.md) already identifies constructor-injected clocks as the long-term direction. [ADR-10](../../decisions/ADR-10-defer-store-integration-until-view-materialization.md) and the [root-snapshot resume plan](../plans/2026-10-03-crdt-root-snapshots.md#resume-after-view-materialization) keep record restoration, automatic root-record saves and `flush()` deferred until materialization is ready.

## Target responsibilities

| Boundary                       | Responsibility                                                                        | Allowed dependencies                                     |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Entity and time logic          | Identity-bearing state, merge rules, timestamp ordering and logical-clock advancement | Core types, explicit runtime inputs and shared utilities |
| State construction             | Schema-to-entity construction, validation, paths and row factories                    | Entities, schemas and supplied initial values            |
| Store application API          | Initialization orchestration, reads, updates and subscriptions                        | State, entity behavior and declared ports                |
| Persistence coordination       | Capture, dirty tracking, write ordering and completion                                | Entity record APIs and the repository port               |
| Synchronization coordination   | Pull/push orchestration, merge application and retry policy                           | Core behavior and the remote port                        |
| React adapter                  | Hook lifecycle, subscription binding and snapshots                                    | Store public API and React                               |
| Storage and transport adapters | IndexedDB transactions, HTTP requests and SSE connections                             | Their port contracts and platform APIs                   |
| Application setup              | Choose implementations, create runtime dependencies and connect them                  | Core factories and concrete adapters                     |

Persistence and synchronization coordinators belong inside the application boundary. IndexedDB and HTTP implementations belong outside it. Extract coordinators as focused modules within `@nn/store` when their slices are implemented.

Keep the existing port packages. Their contracts describe what application workflows need; adapter convenience must not determine the contract. Physical package relocation is unnecessary to establish this ownership.

Source dependencies point toward core behavior and contracts:

```text
React adapter -> Store API -> State and entities
Store workflows -> Repository <- IndexedDB adapter
Sync workflow -> Remote <- HTTP/SSE adapter
Entity logic -> explicit replica dependencies
Application setup -> factories and concrete implementations
```

Runtime calls can travel from a workflow through a port to an adapter. This does not reverse the source dependency direction.

## First slice: construction and loading

### Core state construction

Add synchronous `State.fromValues(schema, initialValues)` construction. `initialValues` is a root-name dictionary whose values have type `unknown`; schema checks and entity construction establish the resulting typed state. An omitted dictionary means no supplied values.

The builder owns the existing rules for supported root shapes, nested field entities, reserved row keys and schema-backed row factories. Collection inputs are arrays of keyed row values; absent collections start empty and absent supported scalar roots retain their current undefined-value behavior. Existing row keys are retained. New rows use the existing identity mechanism until the replica slice replaces it.

Implementation update, 2026-10-14: [atomic rows](2026-10-14-atomic-row-store-design.md) replaced nested field entities and schema-backed row factories with one plain-data register per row and schema-backed row preparers. A builder should normalize plain row data rather than construct field entities.

The builder does not initialize a repository, read storage or attach persistence subscriptions. At this stage it is independent of storage, but entity creation still uses the existing time and identity defaults. Full determinism arrives in the replica slice.

Move repository-backed `State.fromSchema` callers to store initialization. Remove that static method once its callers are migrated so `State.ts` no longer depends on `Repository`. Because `State` is exported publicly, this is a documented API change even though the repository packages currently have version `0.0.0`.

### Application initialization

Add `loadInitialValues.ts` within `@nn/store`. It performs the current repository initialization and reads, returning unknown-valued data for the builder. It does not construct entities or validate CRDT internals.

The initialization sequence is:

1. Check that the schema uses supported root shapes and row-key declarations.
2. If a repository is configured, initialize it using its current contract and read the values required by that schema.
3. Pass the supplied values to `State.fromValues` for construction and validation.
4. Construct the Store and attach its existing subscriptions only after successful state construction.

Initialization failures reject the factory promise with their cause preserved. Do not return a partially initialized store, replace read failures with empty state, or start save subscriptions before validation succeeds. A failed read may leave an initialized database; it must not trigger application data writes.

The stored representation remains primitive root values and keyed collection rows for this slice. This extraction does not claim that those values preserve CRDT history. The deferred record design owns that change.

### Public creation API and React

Export the canonical asynchronous `createStore(options)` from `@nn/store`. Keep `Store.fromSchema(options)` as a compatibility entry point delegating to the same initialization path. Define the options and inferred result in one place.

Keep the current options, including the currently unused `remote` option, in this slice. Moving the factory must not make that option appear functional or begin network activity.

`@nn/react` re-exports the core factory for compatibility. Its implementation focuses on binding `read`, `update` and `subscribe` to React. Update the example application's setup to import `createStore` from `@nn/store` and the hook factory from `@nn/react`.

Keep construction outside render and retain the existing promise-based hook initialization. Preserve typed paths, readonly snapshots, scoped recipes, missing-row behavior, notification batching and reference stability.

### Files and compatibility

The implementation slice centers on `packages/store/src/State.ts`, `Store.ts`, the new loader module, `packages/react/src/index.ts`, their existing tests and `apps/example-react/src/store.ts`. Update the store export map only if the chosen file layout requires it; exports continue pointing directly to TypeScript source.

Add Changesets for the affected public packages. Document the migration from repository-backed `State.fromSchema` to `createStore` or `Store.fromSchema`, and from value-only state construction to `State.fromValues`. Existing React factory imports continue to work through the re-export.

## Later slice: explicit replica ownership

Separate timestamp values from the clock that creates them. Keep timestamp comparison, serialization and the hybrid logical-clock rules in `@nn/time`. The physical-time source is an injected function. UUID generation remains UUID v4 under the existing identity decision, supplied through an explicit identity generator.

Create a replica context explicitly during application setup. It owns one replica identity and logical clock and supplies entity identity generation. Entities created in that context share its clock. Independent replicas in one process have independent contexts; several stores may intentionally share one context.

Every entity creation path must use its owner's context, including schema hydration, nested fields, row factories and manually constructed entities. Receiving or restoring remote state must observe its timestamps before subsequent local mutations mint stamps. Clock overflow and malformed timestamps remain explicit errors.

Default runtime implementations may offer a convenience factory, but importing core types must not generate identities or read the clock. Test implementations provide deterministic physical time and identities without replacing global APIs.

This slice requires its own constructor migration design. Its acceptance criteria include two independent replicas at the same physical time, clock rollback, remote-time observation and a local write after a remote write. The three-part timestamp format and existing merge policies remain in force.

## Later slice: repository semantics

Keep raw reads unknown-valued and narrow them at the owning boundary. A caller-provided generic argument cannot prove the runtime type of persisted data. Entity decoders validate entity records when that representation returns; state construction validates application schema compatibility.

Reduce initialization input to the collection information storage actually needs. State schemas and application validation remain inside the core boundary.

The repository contract must define missing reads, repeated deletion, enumeration behavior and write completion. A successful write or deletion resolves when its transaction commits; transaction aborts reject even if an individual request already succeeded. Errors preserve their underlying cause without requiring application callers to inspect IndexedDB objects.

Use a reusable contract suite for memory and IndexedDB implementations. Compare promised observable behavior, not internal data structures or an incidental iteration order. Include failure and transaction-abort cases, with browser-level IndexedDB coverage for commit semantics in addition to the current emulated tests.

This slice can strengthen the current value-storage adapter before root records return. It does not implicitly approve a storage-format change.

## Deferred slice: root persistence

Resume this work only after the materialization design is complete and the entity-record proposal has been reviewed again. The [existing record proposal](2026-10-04-entity-record-value-metadata-design.md) remains deferred; this spec does not select a new record shape or change `toJSON()` semantics.

Entities own the metadata needed to preserve future merge behavior. Adapters own storage transport. Application persistence coordination owns when to capture records, how to order writes and how callers observe completion.

The coordinator must observe state changes, including metadata-only changes that do not change a React snapshot. UI batching must not drop dirty roots or substitute for persistence ordering. Capture complete records after a synchronous update finishes and serialize writes per root.

Retain the resume plan's completion rules: `flush()` waits for changes preceding its call, later edits cannot postpone that boundary indefinitely, failures reject the wait, and dirty state remains available for retry. A successful repository operation means committed storage. Separate roots have no cross-root atomicity guarantee.

Give coordination explicit lifecycle ownership. Stopping observation releases subscriptions; callers use the completion boundary before shutdown when they require durability. The detailed disposal API belongs in the persistence slice's design, together with in-flight failure behavior.

Preserve working plain-value persistence during earlier slices. Address defects in that behavior explicitly rather than treating a responsibility extraction as permission to silently remove saving.

## Later slice: remote contract and synchronization

For the current invalidation protocol, the remote port receives a callback through `subscribe(onInvalidate)` and returns an unsubscribe function. The application can observe invalidation using only the declared interface. The HTTP adapter's event emitter is not an additional required contract.

Keep HTTP status handling, SSE connection management and wire parsing in `HttpRemote`. Keep merge orchestration, synchronization scheduling and retry decisions in application coordination; entities retain conflict-resolution rules. Incoming state crosses an unknown-valued boundary and is decoded before domain use. Unsubscribing releases the underlying connection resources.

Implementing synchronization requires a separately reviewed payload and error contract after entity records stabilize. It must cover invalid payloads, connection failures, repeated delivery, local edits during requests and prevention of push/pull feedback loops. The standalone example server remains a transport peer, with no requirement to reorganize it during the first slice.

## Verification and dependency enforcement

For the first implementation slice, verify these public behaviors:

1. A headless caller imports `createStore` from `@nn/store` and performs the same reads and updates as the React example.
2. `State.fromValues` constructs and validates state without a repository or database environment.
3. Loading preserves supplied row identities, missing-value behavior and nested schema-backed entities.
4. Repository initialization and read failures reject creation; invalid loaded state never starts save subscriptions.
5. The React compatibility export retains the same inferred types and promise-based hook behavior.
6. Existing path, projection-reference, no-op update and batching tests continue to pass.
7. Existing value-storage round trips keep working, without introducing a new stored representation.

Add focused import restrictions during the affected slices: `State` cannot import repository or concrete adapter modules; entities and time logic cannot import Store, React, storage or transport adapters; Store cannot import React or concrete storage and transport adapters. Port packages stay independent of implementations. Runtime defaults have an explicit assembly location rather than weakening these rules throughout the core.

Run affected package tests, workspace type checks, lint, formatting and spelling checks for implementation. Use existing benchmarks when changes affect materialization or update complexity. This documentation-only step requires formatting and spelling checks, not runtime tests.

Later, the end-to-end architecture acceptance test is to make edits on independent replicas, persist one, restore it and merge a delayed remote change. The restored replica must have the same visible result and future merge behavior as an uninterrupted replica. This test requires record restoration and cannot be claimed by the current value-storage implementation.

## Delivery and review boundaries

| Slice                       | Deliverable                                                                                     | Prerequisite                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Construction and loading | Storage-independent state builder, core creation export, React compatibility and focused checks | Review this written spec, then review a slice-one implementation plan               |
| 2. Replica ownership        | Explicit clocks, identities and entity construction context                                     | Constructor/API design and its implementation plan                                  |
| 3. Repository semantics     | Honest read types, reduced initialization input and committed-write contract                    | Port migration design and adapter contract tests                                    |
| 4. Root persistence         | Entity records, restoration and ordered durable writes                                          | Completed materialization and renewed review of deferred record/persistence designs |
| 5. Synchronization          | Observable remote port and application synchronization workflow                                 | Stable record boundary and reviewed payload/failure semantics                       |

Create the next implementation plan for slice one only. This keeps the first change independently reviewable while preserving the agreed architecture direction. Each later slice updates affected decisions and adds Changesets for its public API changes.

## Rationale

Interface-only changes would leave implicit clock ownership and storage-dependent state construction intact. A package-wide reorganization would create broad churn while materialization and persistence are still evolving. Responsibility extraction within existing packages directly supports the approved goal and lets each behavioral boundary be verified before the next migration.

The [hexagonal architecture research](../../notes/research/hexagonal-architecture.md) supplies the pattern rationale: independently driven application behavior, replaceable external adapters and contracts owned by the application's needs. Folder names and a prescribed number of internal layers are not acceptance criteria.
