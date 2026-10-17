# Entity Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the diff-based store write path with operations applied to field-level entities, so merges converge per field and a write resolves to one entity.

**Architecture:** Three layers. Collection rows become `LWWMap` of field entities instead of one `LWWRegister` per row. A closed operation set (`set`, `insert`, `remove`, `move`, `delete`) is the write path, applied by `apply(entity, op, create)` to an entity found by `resolve(entity, path)`. A proxy draft turns ordinary mutation into those operations, buffering them and flushing once when the recipe returns.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Changesets.

**Spec:** [Entity write path design](../specs/2026-10-17-entity-write-path-design.md)

## Global Constraints

- Do not use TypeScript type casts (`as Type` or `<Type>value`). Narrow or model the type correctly instead.
- `any` is prohibited. Type values of unknown shape as `unknown` and narrow them before use.
- Avoid code comments.
- Add a Changeset for consumer-visible changes to public `@nn/*` packages. `example-react` and `example-server` are ignored by Changesets.
- Never run `git commit` on the user's behalf outside the commit steps in this plan, and never post replies to PR comments.
- Preserve existing staged, unstaged and untracked work. Several target files already contain user changes.
- `RGA` appends only. Any operation that inserts at a position, reorders, or deletes a field throws `StoreError.unsupported`.
- Sync is state based and uses `Entity.merge`. Operations are internal and never serialized.
- Run tests with `pnpm --filter @nn/<package> test`, except `@nn/entities`, which has no `test` script and runs as `pnpm vitest run --project @nn/entities`. Benchmarks run as `pnpm bench` from the repository root.

## Review Focus

- A recipe that throws after a successful mutation must apply nothing. Pinned in Task 9.
- `draft.unshift(row)`, inserting `splice` and `draft.sort()` must throw rather than append. Pinned in Task 9.
- A persisted entry in the current flat format must reset that root to empty, not throw during construction. Pinned in Task 7.
- A `set` naming a field the row schema does not declare must be rejected before anything is applied. Pinned in Task 8.
- `row.key` must still be present in reads, and `draft[0].key = "x"` must throw. Pinned in Task 6 and Task 9.

---

### Task 1: Per-field accessor on `LWWMap`

**Files:**
- Modify: `packages/entities/src/LWWMap.ts`
- Test: `packages/entities/src/LWWMap.test.ts`
- Create: `.changeset/lww-map-field-accessor.md`

**Interfaces:**
- Produces: `LWWMap.prototype.field(name: string): Entity | undefined`

- [ ] **Step 1: Write the failing tests**

```ts
it("returns a field entity by name", () => {
	const title = new LWWRegister("Ticket", "title");
	const map = new LWWMap({ title }, "row-1");

	expect(map.field("title")).toBe(title);
});

it("returns undefined for an undeclared field", () => {
	const map = new LWWMap({ title: new LWWRegister("Ticket", "title") }, "row-1");

	expect(map.field("missing")).toBeUndefined();
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run --project @nn/entities`
Expected: FAIL, `map.field is not a function`

- [ ] **Step 3: Implement `field(name: string): Entity | undefined` in `packages/entities/src/LWWMap.ts`**

Read from the existing private `fields` record using `Object.hasOwn` so an inherited property name cannot resolve.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm vitest run --project @nn/entities`
Expected: PASS

- [ ] **Step 5: Write the Changeset**

`.changeset/lww-map-field-accessor.md`, a `minor` bump for `@nn/entities`, describing `LWWMap.field` as a new accessor for reading one field entity by name.

- [ ] **Step 6: Commit**

```bash
git add packages/entities/src/LWWMap.ts packages/entities/src/LWWMap.test.ts .changeset/lww-map-field-accessor.md
git commit -m "Add per-field accessor to LWWMap"
```

---

### Task 2: `StoreError.unsupported`

**Files:**
- Modify: `packages/store/src/errors/StoreError.ts`
- Test: `packages/store/src/errors/StoreError.test.ts`

**Interfaces:**
- Produces: `StoreError.unsupported(operation: string): StoreError`

- [ ] **Step 1: Write the failing test**

```ts
it("names the unsupported operation", () => {
	const error = StoreError.unsupported("move");

	expect(error).toBeInstanceOf(StoreError);
	expect(error.message).toBe('Store operation "move" is not supported yet.');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @nn/store test StoreError`
Expected: FAIL, `StoreError.unsupported is not a function`

- [ ] **Step 3: Implement the static factory in `packages/store/src/errors/StoreError.ts`**

Follow the existing static factory style in that file.

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @nn/store test StoreError`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/errors/StoreError.ts packages/store/src/errors/StoreError.test.ts
git commit -m "Add unsupported store error"
```

---

### Task 3: Build a row from the schema

**Files:**
- Create: `packages/store/src/rows.ts`
- Test: `packages/store/src/rows.test.ts`

**Interfaces:**
- Consumes: `normalizeObject` and `normalize` from `./normalize`, `ObjectSchema` and `Schema` from `@nn/schema`
- Produces: `createRow(schema: ObjectSchema<Record<string, Schema>>, data: Record<string, unknown>, key: string): LWWMap<Record<string, Entity>>`

Field mapping: `string`, `number` and `boolean` become `LWWRegister` holding the primitive; `object` becomes a nested `LWWMap`; `array` becomes an `LWWRegister` holding the whole array. Each field entity's key is its field name. The row's `LWWMap` key is `key`. Timestamps come from the default `Time.now()`, because an inserted row is a real write.

- [ ] **Step 1: Write the failing tests**

```ts
const ticket = object({ title: string(), assignee: object({ name: string() }), tags: array(string()) });

it("maps primitives to registers, objects to maps and arrays to registers", () => {
	const row = createRow(ticket, { title: "A", assignee: { name: "Ann" }, tags: ["x"] }, "row-1");

	expect(row.key).toBe("row-1");
	expect(row.field("title")).toBeInstanceOf(LWWRegister);
	expect(row.field("assignee")).toBeInstanceOf(LWWMap);
	expect(row.field("tags")).toBeInstanceOf(LWWRegister);
});

it("fills undeclared fields with undefined and drops unknown ones", () => {
	const row = createRow(ticket, { title: "A", extra: "gone" }, "row-1");

	expect(row.field("extra")).toBeUndefined();
	expect(row.field("assignee")?.current).toEqual({ name: undefined });
});

it("rejects a value whose type does not match the schema", () => {
	expect(() => createRow(ticket, { title: 1 }, "row-1")).toThrow(TypeError);
});

it("detaches the row from the supplied data", () => {
	const data = { title: "A", tags: ["x"] };
	const row = createRow(ticket, data, "row-1");
	data.tags.push("y");

	expect(row.field("tags")?.current).toEqual(["x"]);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test rows`
Expected: FAIL, cannot resolve `./rows`

- [ ] **Step 3: Implement `createRow` in `packages/store/src/rows.ts`**

Normalize the whole record against `schema` first, then walk `schema.properties` to build the entity per field. Use `clone` from `./View` so stored values are detached from the caller's objects.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test rows`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/rows.ts packages/store/src/rows.test.ts
git commit -m "Build collection rows as field entities"
```

---

### Task 4: The operation set

**Files:**
- Create: `packages/store/src/Op.ts`
- Test: `packages/store/src/Op.test.ts`

**Interfaces:**
- Consumes: `StoreError.unsupported` from Task 2, `equal` from `./equal`
- Produces:

```ts
export type Op =
	| { kind: "set"; value: unknown }
	| { kind: "insert"; row: Record<string, unknown>; key?: string }
	| { kind: "remove"; key: string }
	| { kind: "move"; key: string; before?: string }
	| { kind: "delete"; field: string };

export type Create = (data: Record<string, unknown>, key: string) => Entity;

export function apply(entity: Entity, op: Op, create: Create): void;
```

Dispatch rules, from the spec: `LWWRegister` with `set` assigns when `equal` reports a difference; `LWWMap` with `set` requires a plain record and assigns each named field through the field's own entity; `RGA` with `insert` calls `create` and appends, minting a key with `ID.create()` when `op.key` is absent; `RGA` with `remove` removes by key; `move` and `delete` throw `StoreError.unsupported`. Any other pairing throws `StoreError.mismatch`.

- [ ] **Step 1: Write the failing tests**

```ts
it("assigns a register and skips an equal value", () => { /* set on LWWRegister, assert current and that timestamp is unchanged for the equal write */ });
it("assigns each named field of a map", () => { /* set on LWWMap with { title: "B" }, assert field("title").current */ });
it("appends an inserted row and mints a key when none is given", () => { /* insert on RGA, assert current.length and a generated key */ });
it("uses a supplied key when inserting", () => { /* insert with key "row-9", assert rga.find("row-9") */ });
it("removes a row by key", () => { /* remove on RGA */ });
it("throws for move", () => { expect(() => apply(rga, { kind: "move", key: "row-1" }, create)).toThrow('Store operation "move" is not supported yet.'); });
it("throws for delete", () => { expect(() => apply(map, { kind: "delete", field: "title" }, create)).toThrow('Store operation "delete" is not supported yet.'); });
it("rejects an operation the entity cannot take", () => { expect(() => apply(register, { kind: "remove", key: "row-1" }, create)).toThrow(StoreError); });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test Op`
Expected: FAIL, cannot resolve `./Op`

- [ ] **Step 3: Implement `apply` in `packages/store/src/Op.ts`**

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test Op`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/Op.ts packages/store/src/Op.test.ts
git commit -m "Add store operation set"
```

---

### Task 5: Path resolution

**Files:**
- Create: `packages/store/src/resolve.ts`
- Test: `packages/store/src/resolve.test.ts`

**Interfaces:**
- Consumes: `PathError` from `./errors/PathError`
- Produces: `resolve(entity: Entity, path: readonly string[], full: readonly string[]): Entity`

`path` is the remaining segments, `full` is the whole path used for error messages. An `RGA` reads the segment as a row key, an `LWWMap` reads it as a field name, and an `LWWRegister` with segments left over is a `PathError.invalid`. A row key or field name that is not there is a `PathError.missing`.

- [ ] **Step 1: Write the failing tests**

```ts
it("returns the entity itself for an empty path", () => { /* resolve(rga, [], ["tickets"]) === rga */ });
it("resolves a row key on a collection", () => { /* resolve(rga, ["row-1"], [...]) === row */ });
it("resolves a field name on a map", () => { /* resolve(row, ["title"], [...]) === titleRegister */ });
it("resolves a nested field", () => { /* ["row-1", "assignee", "name"] */ });
it("rejects a segment below a register", () => { expect(() => resolve(register, ["title"], ["language", "title"])).toThrow(PathError); });
it("reports a missing row and a missing field as missing", () => { /* two expects, both PathError with the missing message */ });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test resolve`
Expected: FAIL, cannot resolve `./resolve`

- [ ] **Step 3: Implement `resolve` in `packages/store/src/resolve.ts`**

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test resolve`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/resolve.ts packages/store/src/resolve.test.ts
git commit -m "Resolve store paths to entities"
```

---

### Task 6: Materialize an entity tree

**Files:**
- Create: `packages/store/src/materialize.ts`
- Test: `packages/store/src/materialize.test.ts`

**Interfaces:**
- Consumes: `clone` and `freeze` behaviour from `./View`
- Produces: `materialize(entity: Entity): unknown`

An `LWWRegister` yields a deep clone of its value. An `LWWMap` yields a record of its materialized fields plus `key` set to the map's entity key. An `RGA` yields an array of materialized rows. The whole result is deeply frozen. A value that cannot be cloned raises `StoreError.notPlain`, as `View.clone` already does.

- [ ] **Step 1: Write the failing tests**

```ts
it("materializes a collection of rows with their keys", () => {
	expect(materialize(rga)).toEqual([{ key: "row-1", title: "A", assignee: { name: "Ann" } }]);
});

it("freezes the result deeply", () => {
	const rows = materialize(rga);
	expect(Object.isFrozen(rows)).toBe(true);
	expect(Object.isFrozen(rows[0].assignee)).toBe(true);
});

it("materializes a register root as its plain value", () => { /* materialize(new LWWRegister("en", "language")) === "en" */ });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test materialize`
Expected: FAIL, cannot resolve `./materialize`

- [ ] **Step 3: Implement `materialize` in `packages/store/src/materialize.ts`**

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test materialize`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/materialize.ts packages/store/src/materialize.test.ts
git commit -m "Materialize entity trees into frozen plain data"
```

---

### Task 7: Tree persistence and the reset on an unknown shape

**Files:**
- Modify: `packages/store/src/persistence.ts`
- Modify: `packages/store/src/State.persistence.test.ts`
- Modify: `packages/index-db-repository/src/IndexDbRepository.ts`
- Modify: `packages/store/src/State.ts`, constructor call site only
- Create: `.changeset/store-tree-persistence.md`

**Interfaces:**
- Consumes: `createRow` (Task 3)
- Produces:
```ts
export type MapEntry = Entry<Record<string, RootEntry>, { kind: "map" }>;
export type RootEntry = RegisterEntry | MapEntry | CollectionEntry;
export function capture(root: Root): RootEntry;
export function restore(name: string, root: Root, stored: unknown, schema?: ObjectSchema<Record<string, Schema>>): void;
```

`capture` walks the tree: a register keeps today's shape with its timestamp, a map yields `{ kind: "map" }` with an entry per field, a collection yields an array of row entries. `restore` rebuilds entities with their stored timestamps and calls `root.merge`, as today. An entry whose shape it does not recognize, including the current flat collection format where rows are register entries, leaves the root at its schema default instead of throwing.

`IndexDbRepository` raises its initial `version` from `1` to `2` and deletes each object store it finds during `onupgradeneeded` before recreating it.

- [ ] **Step 1: Write the failing tests**

```ts
it("captures a collection as rows of field entries with their timestamps", () => {});
it("round-trips a captured tree through restore without minting timestamps", () => {});
it("resets a root to its schema default when the stored entry is the old flat shape", () => {
	const stored = { key: "tickets", data: [{ key: "row-1", data: { title: "A" }, metadata: { kind: "register", timestamp } }], metadata: { kind: "collection" } };
	expect(() => restore("tickets", rga, stored, ticket)).not.toThrow();
	expect(rga.current).toHaveLength(0);
});
it("keeps merging stored data into hand-built entries by timestamp", () => { /* unchanged from today */ });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test persistence`
Expected: FAIL

- [ ] **Step 3: Rewrite `capture` and `restore`, update the one `restore` call in the `State` constructor to pass the row schema, then bump the IndexedDB version**

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test && pnpm --filter @nn/indexdb-repository test`
Expected: PASS

The store suite must be green as a whole, not only the persistence file.

- [ ] **Step 5: Write the Changeset**

`.changeset/store-tree-persistence.md`, a `major` bump for `@nn/store` and `@nn/indexdb-repository`, stating that the stored format changed, that there is no migration, and that existing local data is dropped on first load.

- [ ] **Step 6: Commit**

```bash
git add packages/store/src/persistence.ts packages/store/src/State.persistence.test.ts packages/store/src/State.ts packages/index-db-repository/src/IndexDbRepository.ts .changeset/store-tree-persistence.md
git commit -m "Persist entity trees and reset unknown stored shapes"
```

---

### Task 8: Rewrite `State` reads and single-operation writes

**Files:**
- Modify: `packages/store/src/State.ts`
- Modify: `packages/store/src/State.test.ts`
- Delete: the `reconcile`, `assign`, `valueAt` and `assignAt` helpers in `State.ts`

**Interfaces:**
- Consumes: `createRow` (Task 3), `apply` and `Op` (Task 4), `resolve` (Task 5), `materialize` (Task 6), `restore` (Task 7)
- Produces:
```ts
public read<const Segments extends Path<Data>>(path: Segments): PathValue<Data, Segments>;
public write(path: readonly string[], op: Op): void;
public validate(path: readonly string[], op: Op): Op;
```

`fromSchema` builds an `RGA` per array root and an `LWWRegister` per string root as today, and keeps the row `ObjectSchema` per collection so `createRow` and `validate` can reach it. `fromEntries` keeps today's behaviour and does not validate. `read` resolves from the root's cached materialization, as [Root snapshots](../specs/2026-10-15-root-snapshots-design.md) describes, and the per-root cache is invalidated by the existing root subscription. `write` runs `apply(resolve(root, rest, path), validate(path, op), create)` inside the existing `Batch`.

`validate` normalizes a `set` value against the schema at `path` and throws `TypeError` when the schema has no such field or the value's type does not match. Without a schema it returns the operation unchanged.

- [ ] **Step 1: Write the failing tests**

Keep the existing read, subscription and schema describe blocks in `State.test.ts` unchanged. Replace the write blocks with operation-shaped tests. There is no replace operation, so every test that seeded a collection with `write(["tickets"], () => rows)` seeds it through `State.fromEntries` or repeated `insert` instead. Add the Review Focus case:

```ts
it("sets a nested field through its own entity", () => { /* write(["tickets", key, "assignee", "name"], { kind: "set", value: "Bob" }) */ });
it("leaves sibling field entities untouched", () => { /* assert the title register's revision is unchanged after writing assignee.name */ });
it("inserts and removes rows", () => { /* insert then remove, assert read(["tickets"]) */ });
it("rejects a set naming a field the schema does not declare", () => {
	expect(() => state.write(["tickets", key, "nope"], { kind: "set", value: "x" })).toThrow(PathError);
});
it("rejects a set whose value does not match the field schema", () => {
	expect(() => state.write(["tickets", key, "title"], { kind: "set", value: 1 })).toThrow(TypeError);
});
it("notifies once per write with the changed root names", () => { /* unchanged from today */ });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test State.test`
Expected: FAIL, `state.write` signature mismatch

- [ ] **Step 3: Rewrite `State.ts`**

Replace `write`, `reconcile`, `assign`, `valueAt` and `assignAt`. Keep `Batch`, the per-root change set, `publish`, and the subscription wiring exactly as they are.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test State.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/State.ts packages/store/src/State.test.ts
git commit -m "Apply store writes as operations on entities"
```

---

### Task 9: The draft proxy

**Files:**
- Create: `packages/store/src/draft.ts`
- Test: `packages/store/src/draft.test.ts`
- Modify: `packages/store/src/State.ts`

**Interfaces:**
- Consumes: `Op` (Task 4), `resolve` (Task 5), `materialize` (Task 6), `State.validate` and `State.write` (Task 8)
- Produces:
```ts
export type Buffered = { path: readonly string[]; op: Op };
export function createDraft(entity: Entity, path: readonly string[], buffer: Buffered[]): { draft: unknown; revoke: () => void };
```
in `Path.ts`:
```ts
export type Mutable<Value> = { -readonly [Key in keyof Value]: Mutable<Value[Key]> };
```
and on `State`:
```ts
public update<const Segments extends Path<Data>>(path: Segments, recipe: (draft: Mutable<PathValue<Data, Segments>>) => void): void;
```

A collection draft's target is `new Array(rga.current.length)` with each row draft filled in on first index access. A row draft's target is the materialized row, mutable, including `key`. `set` on a field pushes `{ path: [...path, field], op: { kind: "set", value } }` and writes through to the target. The mutation table from the spec governs the rest; `unshift`, inserting `splice`, `sort`, `reverse` and `delete` push `move` or `delete` operations, which fail at flush. Assigning `key` on a row draft throws `PathError.invalid`.

`State.update` creates the draft, runs the recipe, revokes the draft, validates every buffered operation, and only then applies them all inside one `Batch.run`. A recipe that throws discards the buffer.

- [ ] **Step 1: Write the failing tests**

```ts
it("records a field assignment as a set operation", () => { /* buffer contains one set with the full path */ });
it("records push as an insert and pop as a remove", () => {});
it("records draft.length = 0 as a remove for every row", () => {});
it("reads back a value written earlier in the same recipe", () => { /* draft[0].title = "B"; expect(draft[0].title).toBe("B") */ });
it("does not materialize rows the recipe never touches", () => { /* spy on a row's current getter, assert it was not read */ });
it("applies nothing when the recipe throws", () => {
	expect(() => state.update(["tickets"], (draft) => { draft.push(row); throw new Error("stop"); })).toThrow("stop");
	expect(state.read(["tickets"])).toHaveLength(1);
});
it("throws for unshift, inserting splice, sort and reverse", () => { /* four expects, each toThrow('is not supported yet') */ });
it("throws when a recipe assigns a row key", () => {
	expect(() => state.update(["tickets", key], (draft) => { draft.key = "other"; })).toThrow(PathError);
});
it("throws when the draft is used after the recipe returns", () => { /* stash the draft, mutate it afterwards, expect a TypeError from the revoked proxy */ });
it("emits one notification for a recipe touching many rows", () => {});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test draft`
Expected: FAIL, cannot resolve `./draft`

- [ ] **Step 3: Implement `createDraft` in `packages/store/src/draft.ts` and `State.update` in `State.ts`**

Use `Proxy.revocable`. Intercept the mutating array methods on the `get` trap and leave every other array method to the real target.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nn/store test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/store/src/draft.ts packages/store/src/draft.test.ts packages/store/src/State.ts
git commit -m "Record draft mutations as store operations"
```

---

### Task 10: Path types, `Store.update` and the React tuple

**Files:**
- Modify: `packages/store/src/Path.ts`
- Modify: `packages/store/src/Store.ts`
- Modify: `packages/store/src/Store.test.ts`
- Modify: `packages/react/src/index.ts`
- Modify: `packages/react/src/index.test.tsx`
- Create: `.changeset/store-update-contract.md`

**Interfaces:**
- Consumes: `Mutable` from `Path.ts` (Task 9)
- Produces:
```ts
export type Update<Data, Segments extends readonly string[]> =
	PathValue<Data, Segments> extends object
		? (recipe: (draft: Mutable<PathValue<Data, Segments>>) => void) => void
		: (value: PathValue<Data, Segments>) => void;
public update<const Segments extends Path<Data>>(path: Segments, input: Parameters<Update<Data, Segments>>[0]): void;
```

`Recipe`, `Draft`, `RowDraft` and `PathDraft` leave `Path.ts`; `Path`, `PathValue` and `DataAt` stay. `Store.update` dispatches on `typeof input === "function"`: a function goes to `State.update`, anything else becomes `State.write(path, { kind: "set", value: input })`. The React hook returns `[PathValue<...>, Update<...>]` and forwards without adding a rule of its own.

- [ ] **Step 1: Write the failing tests**

```ts
it("sets a register root from a value", async () => { /* setLanguage("cs") */ });
it("mutates a collection through a recipe", async () => { /* update((draft) => { draft.push(row); }) */ });
it("re-renders when a field of a row changes", async () => { /* keep today's test, migrated to the new updater */ });
it("does not re-render when an unrelated property changes", async () => { /* keep today's test */ });
it("infers a setter for registers and a recipe for collections", async () => { /* expectTypeOf on both tuples */ });
```

Delete `it("uses the returned nested object instead of draft mutations")` and `it("clears a scalar root when its updater returns undefined")`: both pin the return-value contract this task removes. Replace the second with a test that `setLanguage(undefined)` clears the root.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nn/store test && pnpm --filter @nn/react test`
Expected: FAIL on the updater signature

- [ ] **Step 3: Implement the types and both call sites**

- [ ] **Step 4: Run the tests and the type checks**

Run: `pnpm --filter @nn/store test && pnpm --filter @nn/react test && pnpm --filter @nn/store ts:check && pnpm --filter @nn/react ts:check`
Expected: PASS

- [ ] **Step 5: Write the Changeset**

`.changeset/store-update-contract.md`, a `major` bump for `@nn/store` and `@nn/react`. Recipes no longer return a value, registers take a plain value, and `Recipe`, `Draft`, `RowDraft` and `PathDraft` are removed.

- [ ] **Step 6: Commit**

```bash
git add packages/store/src/Path.ts packages/store/src/Store.ts packages/store/src/Store.test.ts packages/react/src/index.ts packages/react/src/index.test.tsx .changeset/store-update-contract.md
git commit -m "Split the update contract by path kind"
```

---

### Task 11: Example app and benchmarks

**Files:**
- Modify: `apps/example-react/src/components/Column/index.tsx:17-28`
- Modify: `apps/example-react/src/components/LanguageSelector/index.tsx:21`
- Modify: `packages/store/src/Store.bench.ts`

**Interfaces:**
- Consumes: the tuple from Task 10

`Column`'s add handler drops its `return draft`. `LanguageSelector`'s change handler becomes `setLanguage(event.target.value)`. The benchmarks keep their two comparisons and their `fromEntries` construction, with the nested-field write expressed as a recipe and the thresholds re-measured against the new cost model.

- [ ] **Step 1: Migrate both components and run the app's checks**

Run: `pnpm --filter example-react ts:check`
Expected: PASS

- [ ] **Step 2: Re-measure and update the benchmark thresholds**

Run: `pnpm bench` from the repository root. `Store.bench.ts` does not match vitest's test include pattern, so `pnpm --filter @nn/store test` never runs it.
Expected: PASS, with `throughput.mean` thresholds set from the measured numbers rather than the old ones.

- [ ] **Step 3: Run the whole suite**

Run: `pnpm -r test && pnpm -r ts:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/example-react/src packages/store/src/Store.bench.ts
git commit -m "Migrate the example app to the new update contract"
```

---

### Task 12: Record the decision

**Files:**
- Create: `docs/decisions/ADR-12-store-rows-as-field-entities.md`
- Modify: `docs/decisions/ADR-03-use-rga-for-collection-row-order.md`, the implementation-update note at the top

**Interfaces:**
- Consumes: nothing. This task ships documentation only.

The ADR follows the house structure used by [ADR-09](../../decisions/ADR-09-stamp-times-with-a-replica-identity.md): frontmatter with `author` and `date`, then Context, Decision, Alternatives considered, Consequences. It records two things: collection rows are `LWWMap` of field entities so merges converge per field, and the persisted format is a tree of register, map and collection entries with no migration from the flat format.

ADR-12 is the next free number. The gaps at 04, 06, 07 and 10 stay unused, and ADR-12 also covers the persistence ground that ADR-03 cites as `ADR-06`, which was never written.

- [ ] **Step 1: Write `ADR-12-store-rows-as-field-entities.md`**

Context states the problem from the spec's Intent: a whole-row register loses every other field's edit on merge, and sync is state based. Decision states the entity mapping table from Task 3 and the three entry kinds from Task 7. Alternatives restate why [Atomic rows](../specs/2026-10-14-atomic-row-store-design.md) chose whole-row registers and why that trade no longer holds. Consequences state the entity-count growth, the dropped local data, and the three Changesets.

- [ ] **Step 2: Update the note at the top of ADR-03**

Replace the dangling `ADR-06` reference with a pointer to ADR-12 for the persistence decision.

- [ ] **Step 3: Verify every relative link resolves**

Run: `grep -o '](\.\./[^)]*)' docs/decisions/ADR-12-store-rows-as-field-entities.md | sed 's/](//;s/)//' | while read -r l; do test -e "docs/decisions/$l" || echo "BROKEN $l"; done`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/ADR-12-store-rows-as-field-entities.md docs/decisions/ADR-03-use-rga-for-collection-row-order.md
git commit -m "Record the field entity decision"
```
