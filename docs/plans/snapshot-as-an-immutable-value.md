# Make a snapshot an immutable value

## Context

`Snapshot` does not hold a snapshot of anything. It is a `Proxy` that forwards every read to live state (`packages/store/src/Snapshot.ts`), so `snapshot.length` answers with the current length, not the length at the time the snapshot was taken. The only thing that is actually captured is the object identity, which `SnapshotManager` drops on invalidation so that `useSyncExternalStore` sees a new reference on the next render.

Three things follow from that, and this step is about all three.

The value is mutable. `Column/index.tsx` calls `tickets.push(...)` on what the API calls a snapshot, because the proxy forwards `push` to the live `Collection` like any other property. A read view is being used as a write handle.

The value tears. `useSyncExternalStore` requires that the snapshot it is handed does not change until the store notifies. This one changes underneath a render, because nothing was copied.

Derived snapshots go stale and never recover. `store.tickets.filter(...)` returns a `Slice`, and the snapshot subscribes to that `Slice`. A push to the parent `Collection` emits on the parent, not on the slice, so the snapshot is never invalidated. It looks like it works only because `Slice.push` re-emits on itself, which is the one write path that happens to go through the slice.

Alongside those, `Snapshot.createSnapshot` calls `state.subscribe(...)` and never unsubscribes. `SnapshotManager` uses `once("invalidated")` for its own bookkeeping, but the subscription on the `Entity` outlives the snapshot. One dead listener per update, forever.

The fix is to make the word true: a snapshot becomes a frozen copy of the selected data, and writing goes somewhere else.

## Design

### 1. A snapshot is frozen data, not an object with behaviour

`Snapshot.ts` loses the class, the proxy, the `events` emitter and the `id` getter. What is left is a function and a type:

```ts
export type Immutable<Value> = Value extends (infer Item)[]
	? readonly Immutable<Item>[]
	: Value extends object
		? { readonly [Key in keyof Value]: Immutable<Value[Key]> }
		: Value;

export function snapshot<Value>(value: Value): Immutable<Value>;
```

`snapshot` copies an array into a new array and deep freezes it, reusing anything already frozen:

```ts
if (Object.isFrozen(value)) return value as Immutable<Value>;
```

That fast path is what keeps repeated snapshots cheap. It assumes nothing hands us a frozen object with unfrozen children, which holds as long as freezing only happens here.

Freezing reaches the item objects themselves, and those are the same objects the `Collection` holds. That is intentional. It makes the rule the design already depends on into a runtime one: **an item is replaced, never mutated in place**. A `ticket.title = "x"` on live data throws in strict mode instead of silently leaking a change into a snapshot that is supposed to be a value. `Collection.push`, `Collection.current =` and `merge` all replace, so nothing in `@nn/entities` breaks.

The snapshot of an entity is the snapshot of its `current`. That is the whole contract, and it works for any `Entity<Value>`, not just `Collection`.

### 2. The selector constraint moves from `Observable` to `Entity`

`Observable` only promises `subscribe`. To read a value out we need `current`, so `getSnapshotOf` constrains on `Entity` instead:

```ts
getSnapshotOf<Value>(selector: (state: State) => Entity<Value>): Immutable<Value>
```

The `// TODO: Remove type casting` on the return goes away with it. There is no `Snapshot<Type> & Type` intersection any more, so nothing has to be cast, and no write method survives on the returned type. `tickets.push(...)` in the example app becomes a compile error rather than a runtime surprise, which is the point.

`@nn/react` follows: `Selector<Schema, Slice>` is constrained on `Entity` too, and `use`'s `useStore` returns `Immutable<Value>`.

### 3. The cache revalidates instead of invalidating

`SnapshotManager` stops subscribing to entities and stops deleting entries. It keeps, per selector, the last frozen value and a stale flag:

```ts
class SnapshotManager<State> {
	private snapshots = new Map<Selector<State>, { value: unknown; stale: boolean }>();

	get<Value>(selector, state): Immutable<Value>; // recomputes if stale or missing
	invalidate(): void; // marks every entry stale
}
```

`get` recomputes a stale entry by re-running the selector against live state and freezing the result — and then compares it with the value it already had. If they are equal, the **previous value is kept**, identity and all.

Equality is shallow and element-wise: same length, then `===` per element. It is enough because the elements are frozen, so an element that changed is a different object by construction.

That comparison is not an optimisation here, it is what makes derived selectors correct and cheap at the same time. Re-running the selector against live state is what fixes the stale `Slice`: a push to the parent collection now reaches the filtered snapshot, because the filter runs again. Keeping the identity when the result is unchanged is what stops every column in the board re-rendering when one of them gains a ticket.

Recomputation is lazy. An update marks entries stale and emits once; the work happens on the next `getSnapshotOf`, which for React is during render.

### 4. The store owns the subscriptions and the write path

The constructor already walks `Object.entries(this.state)`. That walk moves out of the `if (this.repository)` guard, because it is now also where the store subscribes to its own root entities:

```ts
for (const [typeName, entity] of Object.entries(this.state)) {
	this.unsubscribes.push(entity.subscribe(() => this.handleUpdate()));
	if (this.repository) entity.events.on("update", (value) => { … });
}
```

`handleUpdate` marks every snapshot stale and emits `update` once. `destroy()` runs the stored unsubscribes. With the subscription owned here and nothing subscribing inside `Snapshot`, the leak is gone.

Writing gets a name of its own:

```ts
update<Entity>(selector: (state: State) => Entity, mutate: (entity: Entity) => void): void
```

It hands the live entity to `mutate`, then revalidates and emits once for the whole callback. Two things come from routing writes through a single method rather than through whatever object a read happened to return: several mutations in one callback produce one notification instead of one each, and there is now exactly one place to log an operation when the CRDT merge in `Collection` and the `Remote` need an op log. That is the argument for this design over a read-only proxy — not the immutability on its own.

Reads and writes now differ in shape, which is the honest description of what they are:

```ts
const tickets = useStore((state) => state.tickets.filter((t) => t.status === status)); // readonly
update(
	(state) => state.tickets,
	(tickets) => tickets.push(ticket),
); // live
```

Prefer selecting a root entity in `update`. Mutating through a `Slice` still works, and still forwards to the parent while ignoring the predicate — pushing a `done` ticket through a `todo` slice succeeds and then vanishes on the next render. That is the `// TODO: Remove this class` on `Slice` asking to be paid; it is not paid here.

### 5. React reads the value, not an id

`getSnapshot.ts` currently returns `snapshot?.id`, a string standing in for the value, and `index.ts` fetches the real snapshot separately with a `// TODO: get snapshot id here` next to it. Both go away. `getSnapshot` returns the frozen value, `useSyncExternalStore` returns it, and that is what the hook returns:

```ts
const snapshot = useSyncExternalStore(subscribeRef.current, getSnapshotRef.current, getSnapshotRef.current);
```

The third argument is the server snapshot, answering the other TODO. The same function serves: on the server the store is built from the repository and never updates, so it is stable by construction.

`use` returns a pair now, since the write path needs the resolved store too:

```ts
export const { useStore, useUpdate } = use(store);
```

This breaks the current `export const useStore = use(store)`. It is a `0.0.0` package and the changeset says so. `useUpdate` resolves the promised store with `usePromise` exactly as `useStore` does, and returns the store's `update` bound.

## Files

| File                                                 | Change                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/store/src/Snapshot.ts`                     | rewrite: `Immutable` type and `snapshot()` deep freeze; class, proxy, events and `id` deleted       |
| `packages/store/src/SnapshotManager.ts`              | rewrite: selector-keyed cache, stale marking, recompute with identity-preserving equality           |
| `packages/store/src/Store.ts`                        | `getSnapshotOf` returns `Immutable<Value>`; new `update()` and `destroy()`; owns root subscriptions |
| `packages/store/src/Snapshot.test.ts`                | rewrite against the function                                                                        |
| `packages/store/src/SnapshotManager.test.ts`         | rewrite: staleness, recompute, identity reuse                                                       |
| `packages/store/src/Store.test.ts`                   | `snapshot.push` tests become `store.update`; inline snapshots regenerate                            |
| `packages/react/src/getSnapshot.ts`                  | return the value instead of `id`                                                                    |
| `packages/react/src/index.ts`                        | `Selector` constrained on `Entity`; `use` returns `{ useStore, useUpdate }`; server snapshot wired  |
| `packages/react/src/getSnapshot.test.ts`             | assert the frozen value and its identity across calls                                               |
| `packages/react/src/index.test.ts`                   | inline snapshot regenerates; fill in the `it.todo("should use store")`                              |
| `apps/example-react/src/store.ts`                    | export `useStore` and `useUpdate`                                                                   |
| `apps/example-react/src/components/Column/index.tsx` | `handleAddClick` goes through `useUpdate`                                                           |
| `packages/store/README.md`                           | document the snapshot contract, `update()`, and the replace-don't-mutate rule                       |
| `.changeset/*.md`                                    | minor for `@nn/store` and `@nn/react`, both breaking, with the migration                            |

## Verification

`pnpm vitest run packages/store packages/react`. The tests that carry this design:

- a snapshot taken before a push still reads the old length after the push
- the frozen array and its items reject writes (`expect(() => { … }).toThrow()` under strict mode)
- a second snapshot with no change in between is the **same object** (`toBe`)
- a push produces a different snapshot object
- a change to one collection leaves an unrelated selector's snapshot identity untouched
- a filtered selector picks up a push made to the parent collection — the stale-`Slice` bug, as a regression test
- `store.update` with two pushes in one callback emits `update` once
- `destroy()` leaves no listeners on the entities (assert on the emitter's `events` map, the way the existing inline snapshots already peer into it)

Then `pnpm --filter @nn/store ts:check` and `pnpm --filter @nn/react ts:check`, both clean today, so a regression is real. The type-level half of this change is worth an explicit check: `store.getSnapshotOf((s) => s.tickets).push(…)` must not compile. A `// @ts-expect-error` line in the test file asserts that and fails if the write surface ever comes back.

Finish with `pnpm lint:check`, `pnpm format:check` and `pnpm spell:check`.

In the example app, the board is the end-to-end check: adding a ticket to one column must re-render that column and the sidebar count, and must not re-render the other two. React DevTools' highlight-updates confirms it, and it is the behaviour the identity-preserving comparison exists for.

## Not in this step

- An operation log. `update()` is the seam for it; nothing is recorded yet.
- Removing `Slice`. It keeps its current forwarding behaviour and its TODO.
- Structural sharing beyond element reuse. The array is copied whole on every change; a persistent data structure is a later question, and the equality check makes the copy cheap enough that it is not this step's problem.
- `Reference`. It resolves live data through a proxy, so a `Reference` reachable from snapshot data would be a hole in the immutability. Nothing in the store uses it today, and it is left alone.
- A dependency graph. An update marks every snapshot stale, and correctness comes from recompute plus comparison rather than from knowing which selector touched what. Tracking reads per selector is the optimisation to reach for if selector recomputation ever shows up in a profile.
