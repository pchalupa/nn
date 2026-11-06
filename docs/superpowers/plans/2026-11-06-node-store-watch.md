# Node Store and Watches Implementation Plan

> **Superseded in part:** `@nn/node` now exports a standalone `watch(store, selector, listener, options?)` function instead of a `NodeStore` subclass and `createStore` factory. `createStore(schema)` returns a plain `Store` rather than a subclass. See "Where `watch` lives" in the [design](../specs/2026-11-05-node-client-design.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `@nn/node` with `createStore(schema)` and a typed, current-state `watch` method compatible with existing sync engines.

**Architecture:** A Node-package subclass extends the core store and adds observation without another state container. Each watch owns its selection baseline, queued evaluation, and subscription. Engines still attach directly to the returned store.

**Tech Stack:** TypeScript, Node.js >=24, pnpm workspace packages, Vitest, existing NN store/schema/observable packages.

**Spec:** [Approved Node client design](../specs/2026-11-05-node-client-design.md).

## Global Constraints

- Publish the client and its `watch` method in a new public `@nn/node` package.
- Export `createStore(schema)`, consistent with `@nn/react`.
- Keep asynchronous work, concurrency, cancellation, retries, and agent instructions in the agent program.
- The listener receives only the current selected value.
- Use the existing store and support externally attached sync engines.
- No type casts, `any`, code comments, or automatic commits. Use kebab-case file names.
- Export TypeScript source, as existing packages do. Add a Changeset for the new public package.

## Review Focus

- An initial `undefined` selection must deliver once rather than look like an uninitialized baseline: Task 2.
- A stop between notification and evaluation must suppress queued work and release the observer: Task 2.
- A listener changing its own selected state must schedule a later delivery without recursion: Task 2.
- Fresh arrays, sparse arrays, and inherited object keys must not produce false equality results: Tasks 1 and 2.
- Selector/comparator/listener failures must follow the watch error policy without throwing from the originating update: Task 2.

---

## Sequence and file map

This plan is independent of [sync readiness](2026-11-06-sync-readiness.md). Both precede [example-agent](2026-11-06-example-agent.md).

Create `packages/node/package.json`, `tsconfig.json`, and `README.md`; `src/index.ts` exports the factory and public types; `src/node-store.ts` defines the subclass and watch; `src/equal.ts` owns structural comparison. Tests live alongside those modules. A separate `src/sync.test.ts` exercises an attached engine. Do not change the React integration or the core store to expose `watch` there.

### Task 1: Typed store factory and comparison

**Files:** Create `packages/node/package.json`, `packages/node/tsconfig.json`, `packages/node/src/index.ts`, `packages/node/src/node-store.ts`, `packages/node/src/equal.ts`, `packages/node/src/node-store.test.ts`, and `packages/node/src/equal.test.ts`. Update `pnpm-lock.yaml` through pnpm.

**Interfaces:** `NodeStore<S extends ObjectSchema<Record<string, Schema>>> extends Store<S>`; `createStore<S extends ObjectSchema<Record<string, Schema>>>(schema: S): NodeStore<S>`; internal `equal(left: unknown, right: unknown): boolean`. Export `NodeStore` and `createStore` from the package root.

- [ ] **Add the package configuration.** Match `packages/store` scripts and source exports, naming the package `@nn/node`, initial version `0.0.0`, and the root export `./src/index.ts`. Runtime workspace dependencies: `@nn/store`, `@nn/schema`, and `@nn/guards`. Development dependencies: `@nn/typescript-config`, `@nn/sync-engine`, `typescript`, and `vitest`. Extend `@nn/typescript-config/library.json`; use catalog versions and the repository's pnpm version. Run `pnpm install` to register the package.
- [ ] **Write factory tests.** With `schema = object({ count: number(), title: string() })`, assert `createStore(schema)` is a core `Store`, `.schema` is the original schema, and `state.read()` initially equals `{ count: 0, title: "" }`. Update both fields through `state.update` and assert the new snapshot. Use `expectTypeOf` to check the inferred read-only state and assignability to `Store<typeof schema>`.
- [ ] **Write equality tests.** Assert `equal(NaN, NaN)` is true, `equal(0, -0)` is false, nested equal projections compare true, array reordering compares false, and an array hole differs from an explicit undefined entry. Compare `{ a: undefined }` with `{ b: undefined }` as false; a left own key must not match a right inherited key. Distinct dates compare false; the same date object compares true.
- [ ] **Run the failing tests.** Run `pnpm --filter @nn/node test src/node-store.test.ts src/equal.test.ts`. Expect missing implementations or failed assertions, not unrelated workspace configuration failures.
- [ ] **Implement the factory and comparator.** Construct the subclass directly. Follow `packages/react/src/equal.ts` behavior, but explicitly require matching own keys for plain objects. Use `Object.is` first and the existing guards to narrow arrays/objects; no casts. Keep the equality helper private to the package.
- [ ] **Verify.** Run `pnpm --filter @nn/node test src/node-store.test.ts src/equal.test.ts` and `pnpm --filter @nn/node ts:check`; both must pass.

### Task 2: Watch delivery and lifecycle

**Files:** Modify `packages/node/src/node-store.ts`, `packages/node/src/index.ts`, and `packages/node/src/node-store.test.ts`. Create `packages/node/src/watch-errors.test.ts`.

**Consumes:** Factory, subclass, and comparator from Task 1; inherited `state.read()` and `updates.subscribe(observer)`.

**Produces:** The following public types and method. `Snapshot` is a type alias local to the module, not another snapshot implementation.

```ts
type Snapshot<S extends ObjectSchema<Record<string, Schema>>> = ReturnType<Store<S>["state"]["read"]>;

export interface WatchOptions<Result> {
	equal?: (previous: Result, next: Result) => boolean;
	onError?: (error: unknown) => void;
}

export declare class NodeStore<S extends ObjectSchema<Record<string, Schema>>> extends Store<S> {
	watch<Result>(
		selector: (state: Snapshot<S>) => Result,
		listener: (value: Result) => void,
		options?: WatchOptions<Result>,
	): () => void;
}
```

- [ ] **Write delivery tests.** Use a schema with a counter, unrelated title, and an array of rows. Assert no synchronous delivery, one initial delivery after flushing queued evaluations, and exactly one listener argument. Parameterize the initial result over undefined, false, and an empty array. Two synchronous counter edits deliver only the final value; changing and reverting before evaluation delivers nothing extra. Title edits must not notify a counter watch. A fresh equal `map` result must not notify; a changed selected field must notify.
- [ ] **Write lifecycle tests.** Stop before initial evaluation and after a pending update; assert no later callbacks, repeated stop succeeds, and subscription cleanup occurs. A listener that changes counter 0 to 1 must observe `[0, 1]` on separate evaluations with maximum callback nesting depth 1. A custom comparator must receive the last delivered baseline, not a skipped equivalent projection. Two watches must have independent scheduling and baselines. Use `expectTypeOf` inside selector, listener, and comparator to verify inference and the read-only selector input.
- [ ] **Write error tests.** For selector, comparator, and listener throws, assert the originating `state.update` does not throw, `onError` receives the original error once, and that watch stops. Another watch with a valid handler continues. Without `onError`, capture scheduled callbacks by replacing the global scheduling function in this test and assert the queued evaluation throws the original error. Restore globals after each test. A throwing `onError` must escape once. A listener returning a pending promise must not block a later delivery; the test owns and settles its promise.
- [ ] **Run the failing tests.** Run `pnpm --filter @nn/node test`. Expect failures for the missing `watch` contract.
- [ ] **Implement `NodeStore.watch`.** Subscribe before scheduling the first evaluation. Use the standard micro-task queue, one pending flag, a stopped flag, and a discriminated baseline that distinguishes no delivery from a delivered undefined value. Clear the pending flag at evaluation start, compare against the last delivered selection, save the result before notifying, and preserve the baseline on equality. Stop unsubscribes and invalidates queued work. Catch synchronous selector/comparator/listener failures, stop, and call `onError` or rethrow from that scheduled evaluation. Do not inspect or await listener return values. Export `WatchOptions` from `src/index.ts`.
- [ ] **Verify.** Run `pnpm --filter @nn/node test` and `pnpm --filter @nn/node ts:check`. All runtime and type assertions must pass.

### Task 3: Engine compatibility and release documentation

**Files:** Create `packages/node/src/sync.test.ts`, `packages/node/README.md`, and `.changeset/node-store-watch.md`.

**Consumes:** `createStore`, `NodeStore.watch`, and the existing abstract `SyncEngine` API.

**Produces:** Tested direct engine attachment and user documentation for the public package.

- [ ] **Write engine integration tests.** Define a test engine that accepts a core `Store`, forwards encoded entries through its protected `receive`, and records pushes. Attach it directly to the Node store. Deliver an encoded state from a second core store and assert one watch delivery with merged data. Edit the Node store and assert the engine publishes that field. Attach two test engines and verify both can observe the same store. Detaching one engine must not stop the watch or the other engine. Clean up all engine sessions and watches.
- [ ] **Run integration checks.** Run `pnpm --filter @nn/node test src/sync.test.ts` and `pnpm --filter @nn/node ts:check`. Fix compatibility defects in the Node subclass rather than changing the engine contract.
- [ ] **Document the API.** Show shared-schema imports, `createStore`, direct `Engine.attach(store)`, existing `state.read/update`, single-argument listeners, custom equality, error handling, and stop. Explain initial deferred delivery, current-local-state semantics, external readiness and persistence, and application-owned asynchronous work. Add a minor Changeset for `@nn/node` describing the new package and watch API.
- [ ] **Run final checks.** Run `pnpm --filter @nn/node test`, `pnpm --filter @nn/node ts:check`, `pnpm exec oxlint packages/node`, `pnpm exec oxfmt --check packages/node .changeset/node-store-watch.md`, `pnpm exec cspell --no-progress packages/node/README.md .changeset/node-store-watch.md`, and `pnpm exec changeset status`. Expect passing checks and the new package in release status. Run `pnpm ts:check` once to verify the new public types across the workspace; report unrelated baseline failures separately.

## Handoff

This plan finishes the Node library. Sync readiness and `example-agent` have their own plans. Do not begin implementation until the user has reviewed the plans and selected an execution approach. Do not commit unless explicitly asked.
