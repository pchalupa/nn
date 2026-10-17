# Schema-shaped state with store hydration

Status: draft for review, 2026-10-14.

## Goal

`State.fromSchema` should only build the shape of the state from the schema. Loading stored data belongs to store initialization. After this change `State` no longer depends on `Repository`, and the `TODO: schema should not get access to repository` in `Store.fromSchema` goes away.

This is slice 1 ("construction and loading") of the [hexagonal architecture design](2026-10-05-hexagonal-architecture-design.md), with one change. That design builds the state from loaded values in one step with `State.fromValues(schema, values)`. This design builds the empty shape first and fills it in with `state.hydrate(values)`. [Why not `fromValues`](#why-not-fromvalues) explains the choice.

## Current state

`State.fromSchema(schema, repository?)` is async. For each top-level property it checks the schema shape, reads the repository (`getAll` for collections, `get` for strings), normalizes the stored data and builds the entities. `Store.fromSchema` calls `repository.init` before that, so an unsupported schema fails only after the database has been initialized.

The working tree has two failing `State.test.ts` tests that this slice resolves:

- "initializes and hydrate collections, nested fields, and registers" expects `State.fromSchema` to call `repository.init`, which already moved to `Store.fromSchema`. The test moves to `Store.test.ts`.
- "rejects a schema that claims the key for a field of its own" expects `State.fromSchema` to reject a collection item schema that declares `key`. The check isn't implemented yet. It becomes part of the synchronous schema check below.

## Design

### `State.fromSchema(schema)`

```ts
public static fromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
	schema: StoreSchema,
): State<StateFromSchema<StoreSchema>>;
```

It's synchronous and takes no repository. It returns a state with:

- an empty `RGA` for every array property, together with that collection's row preparer
- an `LWWRegister` holding `undefined` for every string property

It throws a `TypeError` for the same schemas as today: unsupported top-level shapes and collection items that aren't object schemas. It also throws for a collection item schema that declares a `key` property, with the message the existing test expects. All checks run before any entity is created.

The `StateFromSchema` type doesn't change. An empty collection and an `undefined` register are both valid values of that type.

### `state.hydrate(values)`

```ts
public hydrate(values: { readonly [Name in keyof Entries]?: unknown }): void;
```

`hydrate` fills in stored data. Values are `unknown` because the repository can't prove their runtime type. `State` checks them against what it knows about each root.

For each root in `values`:

- **Missing root or `undefined` value:** the entry stays as it is.
- **Collection:** the value has to be an array of records. Each row keeps its stored `key` if it's a string. Otherwise it gets a generated ID, as it does today. Each row goes through the collection's row preparer, so schema-backed collections normalize and validate rows exactly like they do today. A state built by hand without a preparer uses the plain-record fallback that `write` already uses.
- **Register:** the value replaces the current one. For schema-backed string roots it's checked with the existing `normalize` rules.

`hydrate` checks and prepares every root before it changes any entity. If any value is invalid, it throws and the state stays unchanged. After that, it replaces each collection's rows with one `RGA` `current` assignment and each register with one `current` assignment.

An unknown root name throws a `PathError`, the same as `read` and `write`.

`hydrate` uses the normal entity setters. That means every loaded value gets a fresh `Time.now()` timestamp and a revision bump, the same as construction today. Restoring stored timestamps is part of the deferred root persistence work. When that lands, it changes how `hydrate` installs values and nothing else. That's the main reason `hydrate` is a separate method rather than the store calling `write` or the entity setters itself.

### Loading values

A new `packages/store/src/loadValues.ts` reads stored values for a state's entries:

```ts
export async function loadValues<Entries extends Record<string, Entity>>(
	entries: Entries,
	repository: Repository,
): Promise<{ [Name in keyof Entries]?: unknown }>;
```

It picks the repository call from the entity kind: `getAll(name)` for an `RGA`, `get(name, name)` for an `LWWRegister`. It doesn't read the schema and doesn't validate anything. Any read failure rejects with the original error.

### `Store.fromSchema`

```ts
const state = State.fromSchema(schema);
await repository?.init(schema.properties);
if (repository) state.hydrate(await loadValues(state.entries, repository));

return new Store(state, repository, remote);
```

The order matters:

1. **Check the schema before touching storage.** An unsupported schema rejects without calling `repository.init`.
2. **Hydrate before the `Store` constructor runs.** The constructor subscribes to every entity for persistence and update notifications. Hydrating after that would write every loaded row back to the repository and emit an `update`.
3. **Never return a partly loaded store.** Init, read and hydration failures reject the promise with the original error, and no subscriptions are created.

`Store.fromSchema` stays async and keeps its options. `createStore` in `@nn/react` keeps delegating to it unchanged.

## Why not `fromValues`

Both approaches keep the repository out of `State`. The difference is who decides what to read.

With `fromValues`, the loader runs before any state exists, so it has to walk the schema to tell collections from strings. That repeats a check `State` already does. With `fromSchema` followed by `hydrate`, the loader asks the state which entries exist and what kind they are. All schema knowledge stays in `State`.

`hydrate` is also the natural place to restore persisted CRDT metadata later.

The cost is a short window where the state exists but hasn't been loaded. Only `Store.fromSchema` sees that window, and it doesn't expose the state until hydration is done.

## Public API changes

- `State.fromSchema` drops the `repository` argument and returns a `State` instead of a `Promise`. Callers that passed a repository move to `Store.fromSchema`. Callers that didn't can drop the `await`, though leaving it in still works.
- New public method `State.hydrate`.
- `Store.fromSchema`, `createStore` and stored data are unchanged.

Add a `.changeset/schema-shaped-state-hydration.md` entry for `@nn/store` describing the migration. `@nn/react` needs no entry.

Update the hexagonal architecture design with an implementation note saying `fromSchema` plus `hydrate` replaces `fromValues`, like the note added for atomic rows. Use the names `loadValues` and `state.hydrate` instead of `loadInitialValues` and `State.fromValues`.

## Out of scope

- Moving `createStore` from `@nn/react` to `@nn/store`. It's part of the same slice but can land on its own.
- Persisting or restoring CRDT metadata and timestamps.
- Changing the `Repository` contract, including what `init` receives.
- Fixing the save subscription in the `Store` constructor (non-atomic row saves, deleted rows staying in storage).
- Replica clocks and identity generation.

## Verification

`State.test.ts`:

- `State.fromSchema` builds empty collections and `undefined` registers synchronously and needs no repository.
- It throws for unsupported top-level shapes, non-object collection items and a collection item declaring `key`.
- `hydrate` keeps stored row keys and their order, generates keys for rows without one, normalizes missing fields and fills string registers.
- `hydrate` rejects data that doesn't match the schema, a non-array collection value and non-record rows. After a rejection, every entry is unchanged, including roots that came before the bad one.
- `hydrate` leaves roots it isn't given, or that are `undefined`, unchanged.
- `hydrate` throws a `PathError` for an unknown root.

`Store.test.ts` (moved from `State.test.ts` where they cover repository loading):

- `Store.fromSchema` calls `init` with the schema properties, `getAll` for collections and `get` for strings, and the loaded values can be read.
- An unsupported schema rejects without calling `repository.init`.
- A failed `init` or read rejects with the original error and never calls `repository.set`.
- Loading doesn't call `repository.set` and doesn't notify subscribers.
- The existing round trip still works: a stored row is loaded, updated and saved with its key.

Run the store and React tests, workspace type checks, lint, formatting and spelling checks.
