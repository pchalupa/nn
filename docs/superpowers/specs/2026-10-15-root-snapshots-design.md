# Root snapshots for MVP

Status: approach approved in conversation on 2026-10-15; written spec awaiting review.

## Goal

Reduce materialized views to one cached immutable snapshot per top-level entry. Keep the React public API and accept whole-collection cloning and extra renders. This replaces the structural-sharing and reference-stability requirements in [Atomic rows with stable snapshots](2026-10-14-atomic-row-store-design.md).

## Reads

Each `State` caches `{ revision, snapshot }` for each root entity it reads. If the entity revision matches, return the cached snapshot. Otherwise, take a register's plain value or collect a collection's row register values, deep-clone with `structuredClone`, and recursively freeze the clone. Cache only successful snapshots. Unsupported entities or values that cannot be cloned raise `InvalidViewError`.

Resolve every read from that root snapshot. Collection row lookup uses a linear search by key; nested paths traverse own object properties. Arrays remain terminal path targets. Direct row reads and collection elements share the same object within a root revision. Remove per-row projections, structural comparisons, and reuse of references across revisions.

The revision cache is required for `useSyncExternalStore`: repeated reads without a root change must return the same reference. Root revisions already include changes emitted by their rows, including direct entity writes. Unrelated roots keep their cached snapshots.

Cloning preserves `undefined` and sparse arrays. Freezing affects only the clone, never caller-owned inputs. Earlier snapshots retain their values after later writes.

## Writes

Keep the current row-register model and resolve the live target at invocation time. Clone the owning row for row and nested-field recipes, apply the returned value, normalize it, and replace the register. Recipes must return the next value; `undefined` is a replacement where the target permits it.

Collection recipes receive a mutable array containing frozen snapshot rows. Reconcile additions, replacements, and removals by key. Keep existing registers, skip existing rows returned by reference unchanged, append additions, and ignore attempts to reorder existing rows. Prepare and validate all changes before applying them within the existing store batch.

Remove `share()` from writes as well as reads. Retain a simple `Object.is` check for identical scalar replacements. Structurally equal object replacements may write, advance register timestamps, notify subscribers, and produce new snapshots. Detach replacement data from recipe-owned objects before storing it so later mutations of those objects cannot silently change state. Preparation and cloning failures apply no queued changes; execution-time subscriber exceptions retain the existing lack of rollback.

## Public API and behavior

Keep `createStore`, `use`, `useStore(...path)`, readonly snapshots, schema-derived path and recipe types, and the value/updater pair. Preserve schema normalization, explicit and generated row keys, protected row identity, missing-row reads as `undefined`, errors before invoking recipes for missing rows, and path validation.

Changing one row now rebuilds the entire collection snapshot on the next read. Unchanged rows and nested objects can receive new references and rerender. Equal-value revisions can also rerender. These are accepted MVP tradeoffs. Repeated reads within a revision, immutable old snapshots, and correct values remain required.

## Implementation scope

- `packages/store/src/State.ts`: root-only snapshot caching, snapshot-based selection, and writes without structural sharing.
- `packages/store/src/View.ts`: retain public readonly types and replace `share()` with cloning and freezing.
- Store and React tests: replace cross-revision identity and render-count expectations with the new guarantees.
- Existing store benchmarks: report whole-root read costs rather than enforcing narrow-read performance expectations.
- Current materialization documentation and a Changeset: describe the changed identity, rendering, and equal-object-write behavior.

Preserve existing working-tree changes. Use no TypeScript casts, `any`, or new code comments. Leave commits to the user.

## Verification

Run affected store and React tests, including type assertions. Verify stable repeated reads, direct-row/collection identity within a revision, invalidation after direct entity changes, unchanged unrelated roots, changing hook paths, retained setters after deletion and replacement, old-snapshot immutability, caller-input isolation, sparse arrays, and validation before mutation. Retain collection membership, key, ordering, hydration, and recipe-result tests.

Run workspace type checks, lint, formatting, spelling, and release-entry validation. Run the existing affected benchmarks to record the accepted performance cost. Report pre-existing failures separately from regressions.
