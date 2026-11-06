# Remove `@nn/node` and `watch` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the unreleased `@nn/node` package and have `example-agent` observe its store directly through `store.updates.subscribe`.

**Architecture:** `example-agent` depends on `@nn/store`, creates its store with `new Store(schema)`, and replaces the `watch(...)` call in `src/index.ts` with an inline subscriber that reads state, selects pending reviews, and calls `reconcile`, reporting errors to `onError`. Library packages other than `@nn/node` are untouched apart from one README sample.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, oxlint, oxfmt, cspell, knip.

**Spec:** `docs/superpowers/specs/2026-11-06-remove-node-watch-design.md`

## Global Constraints

- No TypeScript type casts and no `any`.
- No code comments.
- Kebab-case file names.
- No changes to `Store`, `State`, or `Observable`.
- No README section documenting the subscribe-read-select pattern in `@nn/store`.
- No helper module in `example-agent`; the subscriber is inline in `src/index.ts`.
- Do not run `git commit`. Leave changes in the working tree for the user.

## Review Focus

`src/index.ts` is a top-level script with no test harness, so these are checked by reading the code and by the manual run in Task 1 Step 5, not by unit tests.

- A selector or `reconcile` that throws is reported to `onError` and the subscription stays active.
- On connect, pending reviews that already exist are reconciled immediately, without waiting for a store update.
- On disconnect and on `stop()`, the subscription is removed before the reviewer is stopped, so no `reconcile` runs on a stopped reviewer.
- The subscriber now runs synchronously inside the reviewer's own `store.state.update` when it posts a comment. `reconcile` then aborts a controller whose review already resolved, which must not report an error.
- The agent's own `users` upsert in `observe` runs before subscribing, so it does not trigger `reconcile` with a reviewer that does not exist yet.

---

### Task 1: Move `example-agent` to `@nn/store` with an inline subscriber

**Files:**

- Modify: `apps/example-agent/src/index.ts`
- Modify: `apps/example-agent/src/reviewer.ts:1`
- Modify: `apps/example-agent/src/reviewer.test.ts:1,21`
- Modify: `apps/example-agent/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `Store` class from `@nn/store` (`new Store(schema)`, `store.updates.subscribe(observer: () => void): () => void`, `store.state.read()`); `selectPendingReviews(state, agentId)` and `createReviewer(...)` from `./reviewer`, unchanged.
- Produces: nothing in `example-agent` imports `@nn/node` afterwards.

- [ ] **Step 1: Swap the dependency**

In `apps/example-agent/package.json`, replace `"@nn/node": "workspace:"` with `"@nn/store": "workspace:"`, keeping dependencies sorted. Run `pnpm install`.
Expected: `pnpm-lock.yaml` lists `'@nn/store'` instead of `'@nn/node'` under `apps/example-agent`.

- [ ] **Step 2: Update `reviewer.ts` and `reviewer.test.ts`**

`reviewer.ts`: `import type { Store } from "@nn/store";`.
`reviewer.test.ts`: `import { Store } from "@nn/store";` and `const store = new Store(schema);` in `fixture()`.

- [ ] **Step 3: Replace `watch` in `index.ts`**

- `import { Store } from "@nn/store";`, and `const store = new Store(schema);`.
- In `observe`, after `reviewer = current;`, replace the `watch(...)` line with a local `reconcile` arrow that wraps `current.reconcile(selectPendingReviews(store.state.read(), agentId))` in `try`/`catch`, passing the caught error to `onError`. Assign `stopWatching = store.updates.subscribe(reconcile);`, then call `reconcile()` once.
- Keep `stopWatching`, `pause`, and `stop` as they are.

- [ ] **Step 4: Run checks for the app**

Run: `pnpm --filter example-agent ts:check && pnpm vitest --run --project example-agent`
Expected: no type errors; all `reviewer.test.ts` and `gateway-review.test.ts` tests pass.

- [ ] **Step 5: Run the agent against the dev server**

Run `pnpm dev` in one terminal and `pnpm --filter example-agent dev` in another. Create a ticket in the React app at `http://localhost:3000`.
Expected: the agent posts one review comment on the ticket; editing the description produces one new comment; the agent logs no errors. Stop it with Ctrl-C and confirm it exits cleanly.

### Task 2: Delete `@nn/node` and update docs

**Files:**

- Delete: `packages/node/`
- Delete: `.changeset/node-watch.md`
- Modify: `packages/sync-engine/README.md:9-32`
- Modify: `docs/superpowers/specs/2026-11-05-node-client-design.md`
- Modify: `docs/superpowers/specs/2026-11-06-remove-node-watch-design.md:3`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 leaves no importer of `@nn/node`.
- Produces: none.

- [ ] **Step 1: Delete the package and changeset**

Remove `packages/node` and `.changeset/node-watch.md`, then run `pnpm install`.
Expected: `grep -n "@nn/node\|packages/node" pnpm-lock.yaml` prints nothing.

- [ ] **Step 2: Rewrite the `sync-engine` README sample**

Replace the `watch` import and call with `store.updates.subscribe`. On `Connected`, define `const log = () => console.log(store.state.read().tickets);`, subscribe it, and call it once; otherwise reset to a no-op. Keep the variable name `stopWatching`. In the two paragraphs after the sample, replace "watch"/"watches" with "store subscription"/"store subscriptions", and change "A new watch after each connection delivers the current selection even if it is unchanged" to say that reading state once after subscribing handles the current state on each connection.

- [ ] **Step 3: Record the reversal in the original spec**

In `2026-11-05-node-client-design.md`:

- Under the status line, add: "Superseded in part by [Remove `@nn/node` and `watch`](2026-11-06-remove-node-watch-design.md): `@nn/node` and `watch` were removed, and consumers subscribe to `store.updates` directly."
- In "Agreed direction", replace the first bullet with one stating that Node programs use `Store` from `@nn/store` and observe it with `store.updates.subscribe` and `store.state.read()`.
- At the start of "Where `watch` lives" and "Store API", add one sentence each saying the section is historical and was superseded by the new spec.
- Delete the sentence "Adding an unrelated field to the store should not repeatedly invoke a watcher whose selected value is unchanged."

- [ ] **Step 4: Mark the new spec approved**

In `2026-11-06-remove-node-watch-design.md`, change `Status: draft.` to `Status: approved on 2026-11-06.`

- [ ] **Step 5: Run the repository checks**

Run: `pnpm ts:check && pnpm test && pnpm lint:check && pnpm format:check && pnpm spell:check && pnpm clutter:check`
Expected: all pass. `grep -rn "@nn/node" --exclude-dir=node_modules --exclude-dir=plans .` lists only the two specs' history and supersession lines.
