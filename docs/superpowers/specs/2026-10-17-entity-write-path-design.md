---
author: Petr Chalupa
date: 2026-10-17
---

# Entity write path design

Status: approved in conversation on 2026-10-17.

Supersedes [Atomic rows with stable snapshots](2026-10-14-atomic-row-store-design.md) and [Required update return values](2026-10-14-required-update-return-design.md). Both decisions are reversed on purpose, and the reasons are below. The read model from [Root snapshots for MVP](2026-10-15-root-snapshots-design.md) and the deferral in [ADR-11](../../decisions/ADR-11-defer-the-ordering-crdt.md) both still hold.

## Intent

A write in [`State`](../../../packages/store/src/State.ts) crosses four shapes of the same data before it reaches an entity: the frozen view, a cloned draft, a normalized row, and the value stored in a register. Path navigation, cloning, normalization, array diffing, and deep equality all meet inside `State.write`, which is why the file is hard to read.

The deeper problem is that the store never learns what the caller changed. The update API hands back a whole array and `State.reconcile` guesses the change by diffing that array against the collection. A diff over plain arrays cannot express a move, so reordering is dropped today.

A row is also stored as one `LWWRegister` holding the whole object. [Atomic rows](2026-10-14-atomic-row-store-design.md) chose that on purpose and accepted the loss of field level conflict resolution. The sync layer is the next project, and sync is state based: replicas exchange values and converge through `Entity.merge`. With a whole row register, a merge picks one entire row and discards the other replica's edits to every other field. [`LWWMap`](../../../packages/entities/src/LWWMap.ts) already merges field by field, and the store does not use it anywhere. That is why the 2026-10-14 trade is being reversed now rather than kept.

This design replaces the write path. Writes are recorded as operations instead of inferred from a diff, and a row becomes a map of field entities so merges converge per field.

## Goals

- Field level convergence. Two replicas editing different fields of the same row both keep their edit after a merge.
- A write path that reads as two steps: resolve a path to an entity, apply an operation to it.
- Named slots for `move` and `delete` so adding them later changes the entity layer, not the API.
- Keep the feel of mutating a draft. Callers write `draft.push(row)`, not `collection.insert(row)`.

## Non-goals

- The sync layer itself. Sync is the next project and is not part of this one.
- An ordering CRDT for `RGA`. `move` gets a slot and throws until the algorithm lands, as [ADR-11](../../decisions/ADR-11-defer-the-ordering-crdt.md) describes.
- Tombstones in `LWWMap`. `delete` gets a slot on the same terms.
- Migrating data already stored in IndexedDB. The format changes and old data is dropped.
- Making the operation set the wire format. Sync moves merged state through `merge`, so operations stay internal.
- Reference stability for unchanged rows. [Root snapshots](2026-10-15-root-snapshots-design.md) already accepted whole collection cloning and extra renders, and that stands.

## Anti-goals

These make the result a failure even if the code works.

- A write the entity layer cannot honour is accepted and dropped. `draft.sort()` must throw.
- A recipe that throws halfway leaves half its changes applied.
- The proxy becomes impossible to remove. The operation layer has to stand on its own and be testable without a draft.
- The write path gets simpler by pushing the same confusion into reads or into persistence.

## Constraints

- Repository rules in [AGENTS.md](../../../AGENTS.md): no type casts, no `any`, no code comments, Changesets for consumer visible changes to public `@nn/*` packages.
- `State` is internal. `@nn/store` exports only [`Store.ts`](../../../packages/store/src/Store.ts), so the class can change freely. `Store`, `@nn/react`, `@nn/entities` and the example app are public surface and will break.
- The React binding uses `useSyncExternalStore`, so a read must return the same reference when nothing changed.
- 72 tests pass in `@nn/store` today, and [`Store.bench.ts`](../../../packages/store/src/Store.bench.ts) asserts throughput. Both are the net for this change.

## Design

### Three layers

1. **Entities.** Rows become `LWWMap` of field entities instead of one `LWWRegister` per row.
2. **Operations.** A small closed set of writes the store applies to an entity. This is the real write path.
3. **Draft.** A proxy that turns ordinary mutation into those operations. Sugar on top, in its own file.

### Entities

A root is one of two things, as today. A scalar root is an `LWWRegister`. A collection root is an `RGA`.

What changes is the row. A collection row becomes an `LWWMap` whose fields are entities, built from the row schema:

| Schema of the field | Entity |
| --- | --- |
| `string`, `number`, `boolean` | `LWWRegister` holding the primitive |
| `object` | nested `LWWMap` |
| `array` | `LWWRegister` holding the whole array |

Nested arrays inside a row stay whole value registers. Modelling them as nested `RGA` needs a key per item and the schema has no way to name one. My call.

### Row keys

A row's key is the `LWWMap` entity key. It is not a field entity, and [`ObjectSchema`](../../../packages/schema/src/ObjectSchema.ts) still rejects a declared `key` property.

The materializer writes `key` into the plain row it produces, so `row.key` keeps working in reads, in the example app, and in tests. A `key` supplied on insert is used instead of a generated one. Assigning `draft[0].key` throws, where today it is silently ignored. My call, and it follows the anti-goal about accepting writes we do not honour.

### Operations

```ts
type Op =
	| { kind: "set"; value: unknown }
	| { kind: "insert"; row: Record<string, unknown>; key?: string }
	| { kind: "remove"; key: string }
	| { kind: "move"; key: string; before?: string }
	| { kind: "delete"; field: string };
```

`apply(entity, op)` dispatches on the entity and the operation kind:

- `LWWRegister` and `set` assign the value when it differs, which is what `State.assign` does today.
- `LWWMap` and `set` replaces the row by setting each field.
- `LWWMap` and `delete` throws `StoreError.unsupported`.
- `RGA` and `insert` builds a row `LWWMap` from the schema and appends it, minting a key with `ID.create()` when the caller gave none.
- `RGA` and `remove` removes by key.
- `RGA` and `move` throws `StoreError.unsupported`.

There is no `set` on `RGA`, so a collection cannot be replaced in one write. See [Replacing a collection](#replacing-a-collection).

Deep `equal` stays. Most registers now hold primitives, where it costs one comparison, and it is still correct for array valued fields.

### Validation

`insert` normalizes the whole row against the row schema, as `prepare` does today: unknown fields are dropped, missing fields become `undefined`, and a wrong type throws `TypeError`. A `set` on a field validates against that one field's schema and rejects an unknown field name.

`State.fromEntries`, which has no schema, keeps today's behaviour and does not validate. It stays because the benchmarks and much of `State.test.ts` use it.

### Path resolution

One recursive function replaces `root`, `rowAt`, `valueAt` and `assignAt`:

```ts
function resolve(entity: Entity, path: readonly string[]): Entity
```

At each segment an `RGA` resolves the segment as a row key, an `LWWMap` resolves it as a field name, and an `LWWRegister` has nothing below it, so a remaining segment is a `PathError.invalid`. A missing row or field is a `PathError.missing`.

### Atomicity

Operations are buffered while the recipe runs and flushed when it returns. A recipe that throws applies nothing, which is what `State.test.ts` asserts today and what the anti-goal requires.

The draft writes each mutation through to its own target as well as into the buffer, so a read later in the same recipe sees the value the recipe just wrote. The flush runs inside the existing `Batch`, so a recipe touching twenty rows still emits one change.

### The draft

The draft is a lazy wrapper proxy. The target is a real object and the traps redirect writes onto entities.

For a collection the target is a real array of the right length, with rows filled in on first access:

```ts
const target = new Array(rga.size);
new Proxy(target, {
	get(rows, index) {
		if (typeof index === "string" && rows[Number(index)] === undefined) {
			rows[Number(index)] = rowDraft(rga.at(Number(index)));
		}
		return Reflect.get(rows, index);
	},
});
```

Because the target is a real array, `Array.isArray`, `length`, `map`, `filter` and spread all work without a trap, and a recipe that touches one row does not materialize the rest. Within a row the fields are materialized eagerly, since a row is small. That split is my call.

Mutations map to operations:

| Written in the recipe | Operation |
| --- | --- |
| `draft[i].field = value` | `set` on that field's entity |
| `draft.push(row)` | `insert` |
| `draft.pop()`, `draft.shift()`, removing `splice` | `remove` |
| `draft.length = 0` | `remove` for each row |
| `delete draft[i].field` | `delete`, throws today |
| `draft.unshift(row)`, inserting `splice` | `move`, throws today |
| `draft.sort()`, `draft.reverse()` | `move`, throws today |
| `draft[i] = row` | `set` on that row's `LWWMap` |

`RGA` only appends, so anything that inserts at a position is a `move` and throws. `pop` and `shift` are plain removals and work.

The draft is created with `Proxy.revocable` and revoked when the recipe returns, so a draft kept past the recipe throws on use instead of writing into stale state.

### Replacing a collection

There is no replace operation. Bulk loading goes through `merge`, not through the write path.

This is the simpler of the two options and it is also the correct one for state based sync. The alternative, an `RGA` and `set` operation that diffs the incoming array by key, keeps the existing entity and timestamp for every surviving key. That is what `reconcile` does today, and keeping it would mean the key diff we set out to remove survives in the op layer.

Remove and re-add is not a substitute. It mints a new `LWWMap` with fresh field timestamps for every row, so a replace would beat a remote replica's newer edits on merge. Callers who genuinely want that can still write `draft.length = 0` followed by pushes, and the timestamp consequence is theirs.

[`persistence.restore`](../../../packages/store/src/persistence.ts) already loads stored state by building entities and calling `root.merge`, which preserves timestamps and converges. Sync uses the same door. Tests that seed a collection use `State.fromEntries` or repeated `insert`.

### Reads

Unchanged in shape, and unchanged from [Root snapshots](2026-10-15-root-snapshots-design.md). `read` materializes a root into a plain frozen tree, caches it per root, and drops the cache when the root changes. The materializer now walks entities instead of reading one register, so a changed root costs more to rebuild. We accept that.

### Persistence

`capture` and `restore` walk the tree. Three entry kinds instead of two:

```ts
type MapEntry = Entry<Record<string, Entry>, { kind: "map" }>;
```

alongside the existing register and collection entries.

The format is not compatible with what is stored today. `restore` detects an entry shape it does not recognize and resets that root to empty instead of throwing, so the first load after upgrade shows an empty board rather than failing to boot. [`IndexDbRepository`](../../../packages/index-db-repository/src) bumps its database version and drops its object stores. My call, on the grounds that a hard failure on boot is a worse demo than an empty one.

### React and `Store` API

The second element of the tuple depends on what the path points at. A primitive gives a setter that takes a value. Anything else gives a function that takes a recipe, and the recipe returns nothing.

```ts
const [tickets, update] = useStore("tickets");
update((draft) => {
	draft.push({ title: "New", status: "todo", description: "", assignee: { name: "", email: "" } });
});

const [ticket, updateTicket] = useStore("tickets", key);
updateTicket((draft) => {
	draft.title = "Changed";
});

const [language, setLanguage] = useStore("language");
setLanguage("cs");
```

This reverses [Required update return values](2026-10-14-required-update-return-design.md), which chose one uniform `(draft) => Value` contract. The reason for the reversal is that the proxy observes mutation, so a return value would be a second way to say the same thing, and the two could disagree. It also removes the current trap where forgetting `return draft` writes `undefined`.

`Store.update` carries the same split, so the rule lives in one place and `@nn/react` only forwards it. Row and nested field paths stay, including the four segment path the benchmarks use. A path that lands on an array valued field gives a recipe with a mutable plain array, and its mutations collapse into one `set` on that register.

`PathValue` stays. `Draft`, `RowDraft` and `PathDraft` in [`Path.ts`](../../../packages/store/src/Path.ts) are replaced by the plain mutable shape the proxy is typed as, so the unchecked widening in `valueAt` goes away with them.

## Known gaps to carry forward

These exist today and this design does not fix them.

- `LWWMap.merge` iterates local fields only, so a field present on the remote and missing locally is never added. Field level convergence depends on fixing this before sync lands.
- `LWWMap` has no per field accessor. The operation layer needs one, so `@nn/entities` breaks and ships its own Changeset.
- `RGA` has no ordering algorithm, so `move` has no implementation behind its slot, and `merge` cannot converge removals without tombstones.
- `LWWMap` has no tombstones, so `delete` has no implementation behind its slot.
- `State.fromSchema` supports only `array` and `string` at the top level.

## Alternatives considered

**Tidy the current write path instead.** `State.write` can go from 18 lines to 9 by folding the two branches into one target, moving field navigation into a single helper, and merging the entry and preparer maps. It is an afternoon with no format change. Rejected as the whole answer because it leaves whole row registers in place, and merge behaviour is the reason for this project.

**Keep whole row registers, as [Atomic rows](2026-10-14-atomic-row-store-design.md) decided.** That decision was right while sync was far off: it is less code and the lost conflict resolution had no consumer. Sync is next, so the cost arrives now.

**One `LWWRegister` per root holding a plain array.** Deletes the most code. Also means any two replicas editing any two rows conflict, which is the opposite of the point.

**A fully virtual proxy.** The target would be an empty shell and every trap would synthesize from entities, so nothing is materialized. Better for large collections, but it has to satisfy the engine's invariants between `ownKeys` and `getOwnPropertyDescriptor`, and those failures are hard to debug. The lazy wrapper leaves the door open. If the lazy fill turns out to be fiddly, a plain wrapper over a fully materialized root is also acceptable, because [Root snapshots](2026-10-15-root-snapshots-design.md) already accepted whole collection cloning.

**An `RGA` and `set` operation that reconciles by key.** See [Replacing a collection](#replacing-a-collection).

**Operations as the wire format.** Sync moves merged state through `merge`, so operations stay internal. If sync ever becomes operation based, the set is already there.

## Consequences

Entity count grows with the number of fields, not rows. Ten thousand rows of five fields becomes roughly fifty thousand entities, each with its own emitter and subscription. Memory and subscription cost go up and the benchmarks will show it.

Rebuilding a changed root costs more, because the materializer walks a tree.

Proxies read badly in developer tools. The example app is the demo for the thesis, so this is a real cost and not only an internal one.

Three public packages change and each needs a Changeset: `@nn/entities` gains per field access, `@nn/store` changes its update contract and its stored format, and `@nn/react` changes its tuple. The example app needs updating too, and Changesets ignores it.

Total lines across the repository go up. The write path gets shorter, the proxy and the persistence walk are new. The gain is that each piece has one job and can be tested on its own.

When this lands it needs one new ADR recording field entities and the persistence format. The next free number is 12. The gaps at 04, 06, 07 and 10 stay unused. `ADR-06` is cited by [ADR-03](../../decisions/ADR-03-use-rga-for-collection-row-order.md) for the persistence decision but was never written, so this design's ADR covers that ground too.

## Left to the builder

- File layout, including whether the draft lives in `@nn/store` or its own package.
- Whether operations are a discriminated union applied by a function, or methods on a small wrapper per entity kind.
- The shape of the per field accessor added to `LWWMap`.
- How the draft's `splice` decides between `remove` and `move`.
- Error message wording, and whether `StoreError.unsupported` names the operation or the missing algorithm.
- Test strategy. The operation layer should be testable without a draft, and the draft should be testable by the operations it produces.
- New benchmark thresholds. The current ones assume the old cost model and need re-measuring rather than keeping.
