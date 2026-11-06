# Example Agent Implementation Plan

> **Note:** `createStore` from `@nn/node` now returns a plain `Store`; references to `NodeStore` below mean that `Store` type, re-exported by `@nn/node`. Watches use `watch(store, …)` from `@nn/node`.

<!-- cspell:words eventsource -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/example-agent`, a Node program that shares the board schema, reviews current ticket descriptions, and publishes attributed findings visible in `example-react`.

**Architecture:** A private shared model serves both apps. An application-owned reviewer reconciles a current-state selection, while a runtime module starts and stops its watch based on SSE readiness. A deterministic reviewer demonstrates the integration before selecting an AI provider.

**Tech Stack:** Node.js >=24, TypeScript, tsx, Vitest, `@nn/node`, `@nn/sse-sync`, and the existing React and Express examples.

**Spec:** [Approved Node client design](../specs/2026-11-05-node-client-design.md).

## Global Constraints

- Name the Node example application `example-agent` and place it in `apps/example-agent`.
- Browser and Node programs import the same application schema.
- Observe current state, including after reconnecting. Do not replay past transitions.
- The first demonstration uses one worker per agent identity.
- Keep asynchronous work, concurrency, cancellation, retries, and agent instructions in the agent program.
- No type casts, `any`, code comments, or automatic commits. Apps and the shared example model are private packages.

## Review Focus

- Restored tickets missing newly added fields must still be readable with defaults: Task 1.
- Editing or deleting a ticket during a pending review must prevent obsolete findings: Task 2.
- Reviewed empty content must differ from content that has never been reviewed: Task 2.
- Disconnecting during work and reconnecting with an unchanged selection must cancel old work and start a fresh eligible review: Tasks 2 and 3.
- Restarting after a synchronized completion must not duplicate the comment: Task 3.

---

## Prerequisites and concrete choices

Complete [Node store/watch](2026-11-06-node-store-watch.md) and [sync readiness](2026-11-06-sync-readiness.md) first. `@nn/sse-sync` and the Express server now exist; use them rather than another network engine.

Use a private package `example-schema` in `apps/example-schema` with a source export. This follows the repository's rule that `packages/*` contain public `@nn/*` libraries. Run the Node app with `--experimental-eventsource`; verify the flag on the supported Node 24 baseline as well as the development host. The host's Node 26.11.1 exposes EventSource with that flag. Do not claim Node 24 compatibility from that host check alone.

First demonstrate a description reviewer with deterministic findings. Keep the provider behind `ReviewDescription` so an AI implementation can be substituted later. A review-column agent uses the same query/worker pattern; implement the column and eligibility helper, but a second provider or worker process is not required for the first demonstration.

## File map

- `apps/example-schema`: `package.json`, `tsconfig.json`, `src/index.ts`, and `src/index.test.ts` own the shared schema and inferred types.
- `apps/example-agent`: package/config/env/README files; `src/reviewer.ts` owns asynchronous review work; `src/runtime.ts` owns engine/watch lifecycle; `src/index.ts` owns process startup and signals. Adjacent tests exercise each responsibility.
- `apps/example-react/src/store.ts` imports the shared model; its ticket modal and translations display comments and the new review status.
- `.changeset/config.json` ignores the two new private example packages; `pnpm-lock.yaml` records workspace dependencies.

### Task 1: Shared model and visible comments

**Files:** Create `apps/example-schema/package.json`, `tsconfig.json`, `src/index.ts`, and `src/index.test.ts`. Modify `apps/example-react/package.json`, `src/store.ts`, `src/components/ticket-modal/index.tsx`, `src/components/ticket-modal/index.test.tsx`, and `src/i18n.ts`; add `src/components/ticket-comments.tsx` and `src/components/ticket-comments.test.tsx`. Update `.changeset/config.json` and `pnpm-lock.yaml`.

**Interfaces:** Export `schema`, `status`, `language`, `Status`, `Language`, `Ticket`, and `Comment` from `example-schema`. Retain existing board fields and add status `review`. Add a top-level `comments: Comment[]` collection; each comment has `id`, `ticketId`, `authorId`, `createdAt`, `body`, and `reviewedDescription`, all strings. A review comment doubles as its completion record, so absence of a matching comment represents no completion, including for empty descriptions. The reviewer matches ticket ID, its own author ID, and exact description text. Future human comments use the same body/author fields without qualifying as this agent's review. Keeping comments in a new root field lets old ticket entities retain their existing shape.

- [ ] **Register the shared package.** Add its private package manifest, source export, library tsconfig, `ts:check`/test scripts, and schema/test dependencies following the existing workspace conventions. Add `example-schema` to the React app's workspace dependencies and Changesets ignores. Run `pnpm install`.
- [ ] **Write model and UI tests.** Encode a ticket with the old schema and merge it into a new-schema store; assert old fields survive and root comments default to `[]`. Assert the new status literals are `todo`, `in-progress`, `review`, and `done`. Test comment rendering with resolved author name, fallback author ID, timestamp, and literal body text, filtering by ticket ID. Creating and editing tickets must preserve existing comments.
- [ ] **Run the failing tests.** Run `pnpm --filter example-schema test` and `pnpm --filter example-react test src/components/ticket-modal/index.test.tsx src/components/ticket-comments.test.tsx`. Expect failures for missing model/fields/UI.
- [ ] **Extract and extend the schema.** Move the existing definitions into `example-schema`; use `InferStateType` for exported types. Re-export the existing status/language symbols from the React store module so its consumers keep working. Keep engine attachment in the React app. The added comments field starts empty when old encoded root fields merge; no nested-ticket schema migration is required.
- [ ] **Add comment display.** Render a separate ticket-comments component for an existing ticket beneath its form, selecting its comments and author names from state. Use the existing styles and i18n conventions. Add Review/Ke kontrole and Comments/Komentáře translations. The board already renders columns from status literals, so extend its model rather than adding another board implementation.
- [ ] **Verify.** Run `pnpm --filter example-schema test`, `pnpm --filter example-schema ts:check`, `pnpm --filter example-react test`, and `pnpm --filter example-react ts:check`. Fix schema restoration issues before proceeding; do not silently require users to erase their board.

### Task 2: Application-owned review reconciliation

**Files:** Create `apps/example-agent/package.json`, `tsconfig.json`, `src/reviewer.ts`, and `src/reviewer.test.ts`. Update `pnpm-lock.yaml`.

**Consumes:** Shared `schema`/`Ticket` and the Node store. The caller supplies a stable `agentId` and a review function.

**Produces:** `ReviewInput = Readonly<{ id: string; description: string }>`; `ReviewDescription = (description: string, signal: AbortSignal) => Promise<string>`; `selectPendingReviews(state, agentId): readonly ReviewInput[]`; `selectPendingColumnReviews(state, agentId): readonly ReviewInput[]`; and `createReviewer({ store, agentId, select, review, onError })` returning `{ reconcile(inputs: readonly ReviewInput[]): void; stop(): void }`. Type `state` from the shared store's read snapshot, `store` as `NodeStore<typeof schema>`, `select` as `(state) => readonly ReviewInput[]`, and `onError` as `(error: unknown) => void`. The caller binds its agent ID into `select`, which is used both for observation and final eligibility checks.

- [ ] **Register the agent package.** Add its private manifest and library tsconfig, `test`/`ts:check` scripts, Node/store/model runtime dependencies, and existing workspace test tooling. Add its Changesets ignore and run `pnpm install`.
- [ ] **Write reviewer tests.** Use deferred review results. Reconcile one ticket twice and assert only one active invocation. Change its description, remove it, or move it out of review; assert the old signal aborts after reconciliation and its late result publishes nothing. Also resolve work before the next watch evaluation and assert the final state check rejects obsolete eligibility. Resolve current work and assert exactly one root comment with the ticket ID, agent ID, reviewed description, body, generated ID, and ISO timestamp. Assert a matching comment excludes the ticket, while another agent's comment does not. An empty description with no matching comment is pending; a matching review of empty text is complete. An unrelated title edit must not restart description work.
- [ ] **Write failure and cancellation tests.** Reject active work and assert `onError` receives the error, no completion is written, and no rejection is unhandled. Rejections from already aborted or replaced work settle without reporting a new review failure. A later explicit `reconcile` can retry the same input; there is no tight automatic retry loop. `stop()` aborts pending work, prevents late publication, and makes subsequent reconciliation a no-op. A new reviewer created after stopping can start the same eligible work. Column selection includes only currently `review` tickets.
- [ ] **Run the failing tests.** Run `pnpm --filter example-agent test src/reviewer.test.ts`. Expect missing implementation failures.
- [ ] **Implement reconciliation.** Track work by ticket ID and exact input text with one abort controller per active review. Reconcile removes obsolete work and starts missing work. Before writing a result, confirm the work instance is still active and rerun `select` against current state; it must still include the same ticket/input. Recheck eligibility and matching completion inside the synchronous update recipe before appending to `draft.comments`. Store completion in the comment itself. Settle errors in the agent, not in `watch`.
- [ ] **Verify.** Run `pnpm --filter example-agent test src/reviewer.test.ts` and `pnpm --filter example-agent ts:check`. Tests own their deferred promises and await settlement after cancellation.

### Task 3: Runtime and cross-process demonstration

**Files:** Create `apps/example-agent/src/runtime.ts`, `runtime.test.ts`, `index.ts`, `integration.test.ts`, `README.md`, and `.env.development`; complete `package.json`. Modify `.changeset/config.json` to ignore `example-agent` if not already registered.

**Consumes:** Node `createStore`, `SseSync.attach(store, url)`, `engine.session.state` and `engine.session.changes`, `SessionState`, and Task 2's reviewer.

**Produces:** `startAgent(options: AgentOptions, attach?: AttachEngine): { stop(): void }`. `AgentOptions` contains `url: URL`, `agentId: string`, `agentName: string`, `review: ReviewDescription`, and `onError: (error: unknown) => void`. `AttachEngine` is `(store: NodeStore<typeof schema>, url: URL) => SyncEngine`, defaulting to `SseSync.attach`; tests supply a controlled engine. The entry point uses stable ID `example-description-reviewer` and name `Description reviewer`.

- [ ] **Write runtime tests.** Before connected, assert no review or agent-user insertion. On connected, insert the named user if absent with an empty passkey array, create the reviewer, and watch the pending selection. On other states, stop both. On a later connected state with identical data, create a fresh reviewer/watch and assert eligible work starts. `stop` must unsubscribe status observation, stop watches/work, and detach the engine once; repeated stop is harmless.
- [ ] **Implement the runtime.** Subscribe to status before reading the initial status. Route engine failures to the supplied `onError`; do not replace internal delegates. For initial failed connection attempts, report the error and let the process supervisor restart rather than inventing base-session recovery. For post-bootstrap SSE interruptions, use the readiness plan's reconnect behavior.
- [ ] **Implement the deterministic review and entry point.** The review function checks for nonempty description and the case-insensitive phrases `steps to reproduce` and `expected result`, returning a readable findings list or `No description issues found.` Respect an aborted signal. Read `REMOTE_URL`, defaulting in the committed development env file to `http://localhost:3001/sync`. Register SIGINT/SIGTERM cleanup. Use `tsx --experimental-eventsource --env-file=.env.development src/index.ts` for the `dev` script and the matching Node flag for integration tests. Add `@nn/node`, `@nn/sse-sync`, `@nn/sync-engine`, and `example-schema` runtime dependencies; use existing workspace versions for tsx and test tools. Document the deterministic mode clearly as an integration example.
- [ ] **Write an actual transport integration test.** Import `createServer` and `createMemoryDatabase` from the private `example-server` exports and listen on an ephemeral port. Seed an encoded board before connecting the agent, with both a ticket needing review and one whose matching agent comment already exists. Wait for the new comment in a second synchronized store; assert author, body, and reviewed input, and no duplicate for the completed ticket. Stop/restart the agent against the same server data and assert no repeated comment. Close all streams, watches, servers, and work in cleanup. Use bounded condition waits, not arbitrary sleeps.
- [ ] **Verify the demonstration.** Run `NODE_OPTIONS=--experimental-eventsource pnpm --filter example-agent test`, `pnpm --filter example-agent ts:check`, and `pnpm ts:check`. Run the agent checks on Node 24 before claiming baseline compatibility. Start the example server and agent with the browser closed, create a ticket through a second Node store, and confirm the review appears when opening the React board. After a synchronized result, restart the agent and confirm no duplicate comment. Check the normal browser create/edit/move flow and comment display.
- [ ] **Document and run final checks.** Explain startup commands, shared schema, stable agent identity, the deterministic provider boundary, interruption behavior, and local-versus-synchronized completion. Run scoped lint, formatting, spelling, the full affected package tests, and Changesets status. Private example changes do not require public release entries.

## Handoff

This completes the first agent integration. Selecting an AI provider and running multiple distributed workers remain later application work. Do not commit unless explicitly asked.
