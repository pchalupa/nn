# List Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mutating array methods on draft lists cheap, and keep primitive list registers by value when the order allows it.

**Architecture:** `ListTracker` intercepts `splice`/`shift`/`unshift`/`pop`/`reverse` and runs them on its raw target, resolving only returned elements into drafts. `ListStrategy.match` delegates all-primitive lists to a new pure `matchValues` function that matches by value for order-preserving edits and falls back to positional matching otherwise.

**Tech Stack:** TypeScript, Vitest 5 (`vitest --run`, projects config at repo root), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-11-17-list-reconciliation-design.md`

## Global Constraints

- No type casts (`as Type`, `<Type>value`), no `any`; type unknown shapes as `unknown` and narrow.
- Prefer `if` over ternaries. Kebab-case file names. No code comments.
- Reorders stay ignored: `store.test.ts` "ignores a reorder" and `list-strategy.test.ts` "keeps item order on a reorder-only draft" must pass unchanged. No `RGA.current = …` assignments.
- A draft never hands out a raw `Entity`.
- Value matching never changes the visible order of a primitive list compared to today.
- Every existing test passes unchanged.
- Never run `git commit` (AGENTS.md). Each task ends with a checkpoint instead.

## Delivery

Each task ships as its own PR, branched from `main`, with its own Changeset. The tasks share no code, so either PR can merge first. Open Task 1 first so CodSpeed attributes the benchmark change to it alone.

| PR  | Task                         | Branch                      |
| --- | ---------------------------- | --------------------------- |
| 1   | Task 1: raw mutating methods | `list-tracker-raw-mutators` |
| 2   | Task 2: value matching       | `list-value-matching`       |

Committing, pushing and opening each PR happen only when the user asks.

## Review Focus

1. **Move within a list via `splice` then `push`** (`const [a] = draft.tickets.splice(0, 1); draft.tickets.push(a)`): the row must keep its entity and key, not be tombstoned and recreated. Pinned in Task 1 Step 1.
2. **First access to an unfilled list is a mutator** (`draft.tickets.splice(…)` before any read): the list must fill first. Pinned by Task 1 tests, whose fixture lists start unfilled.
3. **`shift`/`pop` on an empty list** return `undefined`, not a crash. Pinned in Task 1 Step 1.
4. **Duplicate primitive values** (`["a","a","b"]→["a","b"]`): exactly one `a` register removed. Pinned in Task 2 Step 1.
5. **Primitive reorder** (`["a","b"]→["b","a"]`): stays positional (register rewrites, visible order as today), never remove plus push. Pinned in Task 2 Step 1.

---

### Task 1: Run mutating array methods on the raw `ListTracker` target

**Files:**

- Modify: `packages/store/src/projections/tracker/list-tracker.ts`
- Modify: `packages/store/src/projections/tracker/tracker.ts` (make `write()` protected)
- Test: `packages/store/src/projections/draft.test.ts`, `packages/store/src/store.test.ts`

**Interfaces:**

- Consumes: `Tracker.read(entity: Entity): unknown` (protected), `Tracker.write(): object` (change from private to protected), `RGA.find(key: string): Entity | undefined`.
- Produces: no new public API. `draft.<list>.splice|shift|unshift|pop|reverse` behave like `Array.prototype` methods on plain data.

- [ ] **Step 1: Write the failing tests**

In `draft.test.ts` (uses the existing `fixture()` with items `A`, `B`, `C`):

```ts
it("runs splice on the raw list and resolves only the removed items", () => {
	const { items, draft } = fixture();
	const list = at(draft.value, "items");

	assertArray(list);

	const removed = list.splice(0, 1);
	const target = draft.inspect(list)?.target;

	assertArray(target);
	expect(Entity.is(removed[0])).toBe(false);
	assertObject(removed[0]);
	expect(draft.identify(removed[0])).toBe(items.current[0]);
	expect(Entity.is(target[1])).toBe(true);
	expect(draft.inspect(list)?.written).toBe(true);
});

it("hands out item drafts after a raw mutation shifts indexes", () => {
	const { items, draft } = fixture();
	const list = at(draft.value, "items");

	assertArray(list);
	list.shift();
	list.unshift({ title: "Z", assignee: { name: "Ann" } });

	expect(Entity.is(list[1])).toBe(false);
	assertObject(list[1]);
	expect(draft.identify(list[1])).toBe(items.current[1]);
	expect(Entity.is(list[2])).toBe(false);
	expect(draft.identify(list[2] ?? {})).toBe(items.current[2]);
});

it("returns the list draft from reverse and undefined from an empty pop or shift", () => {
	const { draft } = fixture();
	const list = at(draft.value, "items");

	assertArray(list);
	expect(list.reverse()).toBe(list);

	list.length = 0;

	expect(list.pop()).toBeUndefined();
	expect(list.shift()).toBeUndefined();
});
```

In `store.test.ts`, under `describe("draft edits")` (uses `setupItems()`):

```ts
it("keeps an item moved with splice and push", () => {
	const store = setupItems();
	const before = store.read();

	store.update((draft) => {
		const [first] = draft.tickets.splice(0, 1);

		if (first) draft.tickets.push(first);
	});
	expect(store.read().tickets).toStrictEqual(before.tickets);
	expect(store.read().tickets[0]).toBe(before.tickets[0]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest --run packages/store/src/projections/draft.test.ts packages/store/src/store.test.ts`
Expected: FAIL on "runs splice on the raw list…" (`target[1]` is a draft, not an `Entity`, because the native `splice` read every item). The other new tests may already pass; they guard the change.

- [ ] **Step 3: Implement the interception in `list-tracker.ts`**

- Override `get` so that for the string keys `splice`, `shift`, `unshift`, `pop`, `reverse` it returns a function that calls `this.write()`, applies the matching `Array.prototype` method to the raw target with the given arguments, and maps the result:
  - `splice`: each element of the returned array that `Entity.is` → `this.read(element)`.
  - `shift`, `pop`: same for the single returned element.
  - `reverse`: return `this.proxy`.
  - `unshift`: return the number unchanged.
- Check the mutator keys before the existing `!this.filled` branch. `write()` fills the list.
- Look the method up with `Reflect.get(Array.prototype, key)` into an `unknown` and narrow with `typeof … === "function"`, then `Reflect.apply`. Cache one wrapper per key per tracker so `list.splice === list.splice`.
- Replace `pending` with an index-independent check: `Entity.is(value) && this.entity.find(value.key) === value`. Drop the `items` comparison from `pending` and keep `items`/`snapshot()` for the unfilled read path.
- In `tracker.ts`, change `private write()` to `protected write()`.

- [ ] **Step 4: Run the store package tests to verify they pass**

Run: `pnpm vitest --run --project @nn/store`
Expected: PASS, all tests, including the existing "hands out item drafts, never entities…" and "ignores a reorder".

- [ ] **Step 5: Measure**

Run: `pnpm bench --reporter=verbose` and compare "removes an item from a list of 1,000 items" with the baseline local mean of 0.3137 ms (`main` at `685d90a`).
Expected: a clearly lower mean. Record both numbers for the PR description.

- [ ] **Step 6: Add the Changeset**

Use the changeset-authoring skill. Create one `.changeset/*.md` with `"@nn/store": patch`: mutating array methods on draft lists (`splice`, `shift`, `unshift`, `pop`, `reverse`) no longer copy every item.

- [ ] **Step 7: Checkpoint**

Run: `pnpm test && pnpm ts:check && pnpm lint:check && pnpm format:check && pnpm spell:check && pnpm clutter:check`
Expected: all pass. Do not commit. This task is PR 1.

---

### Task 2: Match primitive list items by value when order is preserved

**Files:**

- Create: `packages/store/src/reconciliation/match-values.ts`
- Create: `packages/store/src/reconciliation/match-values.test.ts`
- Modify: `packages/store/src/reconciliation/list-strategy.ts` (`match`)
- Test: `packages/store/src/reconciliation/list-strategy.test.ts`
- Create: `.changeset/<name>.md`

**Interfaces:**

- Consumes: `Entity.current` (register value), `Object.is`.
- Produces: `export function matchValues(items: readonly Entity[], values: readonly unknown[]): Array<Entity | undefined>`. The result has `values.length` entries. Entry `i` is the existing register to keep for `values[i]`, or `undefined` for a value that needs a new register. Registers absent from the result get removed by `ListStrategy`.

- [ ] **Step 1: Write the failing tests**

`match-values.test.ts`, with a helper `registers(...values: unknown[])` that returns `LWWRegister`s with distinct keys. Each case asserts the result with `toStrictEqual` against the listed registers (`A`, `B`… are the registers for `a`, `b`…):

| Case                                       | items   | values       | expected              |
| ------------------------------------------ | ------- | ------------ | --------------------- |
| removes from the middle                    | a b c   | a c          | A C                   |
| removes scattered items                    | a b c d | a c          | A C                   |
| removes one duplicate                      | a a b   | a b          | A₁ B                  |
| appends                                    | a b     | a b c        | A B undefined         |
| removes and appends                        | a b c   | a c d        | A C undefined         |
| appends after a hole                       | x       | x, (hole), z | X undefined undefined |
| rewrites an overwrite with a common suffix | x y     | z y          | X Y                   |
| rewrites a single overwrite                | x       | z            | X                     |
| keeps a reorder positional                 | a b     | b a          | A B                   |
| keeps an insert at the front positional    | red     | green red    | R undefined           |
| matches NaN                                | NaN     | NaN          | N                     |
| drops everything                           | a b     | (empty)      | (empty)               |

In `list-strategy.test.ts`, add:

```ts
it("removes only the register of a value removed from the middle", () => {
	const list = tags.create(["a", "b", "c"], "tags");
	const [a, , c] = list.current;

	tags.reconcile(list, ["a", "c"], context);

	expect(list.current).toStrictEqual([a, c]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest --run packages/store/src/reconciliation`
Expected: FAIL. `match-values` cannot be resolved, and the new `list-strategy` test gets `[a, b]` with `b` rewritten to `"c"`.

- [ ] **Step 3: Implement `matchValues` in `match-values.ts`**

Algorithm (the spec's rules 1–4):

```text
p = length of the common prefix (Object.is on items[i].current vs values[i])
s = length of the common suffix, not overlapping p on either side
oldMiddle = items[p .. items.length - s], nextMiddle = values[p .. values.length - s]
greedy: walk nextMiddle, for each value advance a pointer through oldMiddle to the first Object.is match;
        on a miss, stop; matched = the pairs found, tail = nextMiddle from the miss onward
if tail is empty                                      -> value result
else if s == 0
     and (oldMiddle is empty or matched is non-empty)
     and no tail value Object.is any unmatched oldMiddle value -> value result, tail entries undefined
else                                                   -> positional: entry i = items[i] (undefined past the end)
value result = prefix items, matched items, undefined for each tail value, suffix items, in values order
```

Make the greedy pointer search not advance on a miss.

- [ ] **Step 4: Use it from `ListStrategy.match`**

In `list-strategy.ts`: if no element of `value` is an object (`isObject`), return `matchValues(list.current, value)`. Otherwise keep the existing per-item loop unchanged.

- [ ] **Step 5: Run the store package tests to verify they pass**

Run: `pnpm vitest --run --project @nn/store`
Expected: PASS, including the existing "matches primitive items by index", "treats holes in a sparse list as missing values" and the `store.test.ts` `unshift("green")` case.

- [ ] **Step 6: Add the Changeset**

Use the changeset-authoring skill. Create one `.changeset/*.md` with `"@nn/store": patch`: primitive lists keep each surviving value's entry when values are removed or appended, instead of rewriting entries by position.

- [ ] **Step 7: Checkpoint**

Run: `pnpm test && pnpm ts:check && pnpm lint:check && pnpm format:check && pnpm spell:check && pnpm clutter:check`
Expected: all pass. Do not commit. This task is PR 2.
