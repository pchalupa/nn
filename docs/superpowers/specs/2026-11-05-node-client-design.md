# Node.js client and state watches

Status: approved on 2026-11-06.

Superseded in part by [Remove `@nn/node` and `watch`](2026-11-06-remove-node-watch-design.md): `@nn/node` and `watch` were removed, and consumers subscribe to `store.updates` directly.

Implementation plans: [Node store and watches](../plans/2026-11-06-node-store-watch.md), [sync readiness](../plans/2026-11-06-sync-readiness.md), and [example-agent](../plans/2026-11-06-example-agent.md).

## Intent

Add a general Node.js client for NN. A background program should use the same schema and synchronized state as the browser app. AI agents are one use case; CLI tools, integrations, and ordinary workers should use the same client.

The new `example-agent` app in `apps/example-agent` runs a description reviewer that reads tickets and posts findings as comments. Another agent can review tickets that currently need work in the review column. These programs keep running independently of the browser and share the board's data with `example-react`.

## Agreed direction

- Node programs use `Store` from `@nn/store` and observe it with `store.updates.subscribe` and `store.state.read()`, selecting the state they need themselves. `@nn/store` stays unchanged.
- Name the Node example application `example-agent` and place it in `apps/example-agent`.
- Browser and Node programs import the same application schema. Runtime schema discovery is unnecessary.
- Use the existing store and support externally attached sync engines. Filesystem or SQLite engines can be added later.
- Observe current state, including after reconnecting. Do not replay past transitions to decide what an agent should do.
- Keep asynchronous work, concurrency, cancellation, retries, and agent instructions in the agent program.
- Treat agents as application users. Their comments and changes should identify them, as described in the [example specification](../../example/specification.md).

Plain stores are agreed; the standalone `watch` function was later removed. The implementation structure and detailed defaults below are design proposals, not additional requirements supplied by the user.

## Approaches considered

### Headless NN client: selected

An independent Node program owns a local NN store, attaches sync engines, observes state, and makes updates. This reuses NN's local-first model and lets developers choose their agent framework. The program must import the app's schema and integrate with NN directly.

This is the selected direction, broadened from an agent-specific client to a general Node.js client.

### Agent gateway: deferred

An always-running service could expose application operations through tools, potentially MCP, and deliver work to external agents. That would support tools written in other languages and agents without a direct NN integration. It also introduces another service and an operation-mapping layer.

A gateway can later use the Node client. It is not needed for the shared-schema programs discussed here.

### API shape: store instead of a client wrapper

The initial proposal used `createClient(schema)` with `client.store`, forwarded read/update methods, and `client.watch`. That distinguished the wrapper from the underlying store, but added another object without owning authentication or engine lifecycle.

The selected API is the store itself. Engines attach directly to it, reads and updates use its existing `state` API, and `watch` is available on that same store.

### Where `watch` lives: a function in `@nn/node`

This section is historical; `watch` and `@nn/node` were removed by [Remove `@nn/node` and `watch`](2026-11-06-remove-node-watch-design.md).

The first implementation added `watch` in a new `@nn/node` package through a `NodeStore` subclass and a `createStore` factory. The subclass existed only to keep `watch` out of `@nn/store` while still calling it as `store.watch`. Nothing in `watch` is Node-specific: it reads `state`, subscribes to `updates`, and schedules work on the micro-task queue, which browsers also provide.

Two alternatives were drafted. A method on the core `Store` gives every store the same API in Node, the browser, and tests, and it works with `@nn/react` stores unchanged. A standalone `watch(store, selector, listener)` function keeps `Store` minimal, as [ADR-13](../../decisions/ADR-13-attach-persistence-and-sync-from-outside-the-store.md) describes, but reads less naturally and is harder to discover.

The standalone function was selected, published from `@nn/node`. It keeps `Store` as minimal as ADR-13 describes and follows the same "attach from outside" pattern as sync engines and `use()` in `@nn/react`. `@nn/node` holds integrations for programs running outside React, so a browser app that needs no observation installs none of it. The trade-off is ergonomics: `watch(store, …)` reads less naturally than a method and is not offered by editor completion on `store.`, and comparable single-store APIs such as Firestore `onSnapshot` and Zustand subscriptions use methods. A method on `Store` was implemented briefly before this decision and can be revisited if the function proves awkward.

## Scope and boundaries

The store provides typed reads, updates, and watches. It supports any attached engine whose implementation runs in Node. It does not own a transport, persistence backend, workflow queue, AI model, or authentication protocol.

The client observes its local replica, not a globally authoritative snapshot. A successful local update does not mean the change is durable or has reached another replica. Those guarantees belong to the attached engines.

An agent's identity is separate from NN's replica identity. A replica ID distinguishes synchronized edits; it does not authenticate an application user or automatically supply comment authorship. Application code supplies its agent user identity and follows the application's access rules.

Separate serverless sharing work defines its own protected document boundary. This client design does not establish access rights to those documents. An integration with that boundary would be separate work.

Avoid an agent-only API, a mandatory backend, and a second state or synchronization implementation.

## Current foundations and gaps

- [`Store`](../../../packages/store/src/store.ts) exposes `state`, `schema`, `changes`, and `updates` independently of React.
- [`State`](../../../packages/store/src/state.ts) provides typed read-only snapshots and draft-based updates. The view caches snapshots by entity revision.
- [`SyncEngine`](../../../packages/sync-engine/src/sync-engine.ts) receives an ordinary store. Engines merge incoming state and publish local changes.
- [`@nn/react`](../../../packages/react/src/index.ts) already selects state and compares results using a recursive [equality helper](../../../packages/react/src/equal.ts).
- Store notifications are synchronous. There is no selector-based `watch` method today.
- Sync lifecycle code has a connected state after initial pulls have merged, but no public subscription intended for applications to observe readiness. Existing code and [ADR-16](../../decisions/ADR-16-give-sync-engines-a-connection-lifecycle.md) differ on some lifecycle visibility details; implementation must use the current code as its starting point.
- Recovery is not automatic in the current base engine. A disconnected session does not restart just because it has local edits.
- `@nn/sse-sync` is now available and attached by the React example. Its stream opens after receiving and merging the initial snapshot. Node runtime support and readiness during stream interruptions need integration checks; `@nn/node` does not provide a transport itself.
- The example currently defines its schema inside the React app. Comments, a review column, and review-completion records are also missing from that implemented schema.

## Store API

This section is historical; [Remove `@nn/node` and `watch`](2026-11-06-remove-node-watch-design.md) replaced `watch` with direct `store.updates` subscriptions.

`watch` is a function in `@nn/node` that takes the store as its first argument. It uses only the store's public `state` and `updates`, so existing engines need no changes and there is no second state container.

```ts
import { schema } from "@example/model";
import { createStore, watch } from "@nn/node";

const store = createStore(schema);

const stop = watch(
	store,
	(state) => state.tickets.length,
	(count) => {
		console.log(count);
	},
);

const snapshot = store.state.read();

store.state.update((draft) => {
	draft.language = "cs";
});

stop();
```

`@example/model` is an illustrative shared application package, not an existing dependency. These examples describe the intended API. It is implemented in `@nn/node`.

- `createStore(schema)` constructs a plain `Store` synchronously, with the schema's default state.
- An engine attaches directly through its normal factory, such as `Engine.attach(store)`.
- `store.state.read()` retains the existing deep read-only snapshot type.
- `store.state.update(recipe)` retains the existing schema-based draft inference.
- `watch(store, selector, listener, options?)` returns an idempotent stop function.

The caller owns attached engines and their lifecycle. The first version needs no client-level engine registry or combined `connect`/`disconnect` API. On shutdown, the application stops watches, finishes or cancels its work, and closes attached engines using their supported lifecycle APIs. Stopping a watch does not flush persistence or delivery.

## Watch contract

This section is historical; [Remove `@nn/node` and `watch`](2026-11-06-remove-node-watch-design.md) replaced `watch` with direct `store.updates` subscriptions.

### Inputs and delivery

The selector receives the same read-only snapshot as `store.state.read()` and returns a selected value. The listener receives only the current selected value. This matches the current-state model and gives the initial delivery the same shape as later deliveries. Application code can retain a prior value if it needs to compare transitions.

The selector is synchronous and pure. It must not mutate state, start work, or read a clock or external service to determine its result. Only store updates cause reevaluation. Derived objects and arrays must be treated as immutable by the selector and listener, even when they were freshly allocated outside the frozen store snapshot.

There is one initial delivery, even when the selected result is empty, false, or undefined. After that, delivery occurs only when the selected value differs from the last delivered value. Each watch retains its last delivered selection internally for equality comparison and has independent scheduling.

### Scheduling

Proposed default: evaluate and deliver in the JavaScript micro-task queue, including the initial delivery.

1. Register for `store.updates` and schedule an initial evaluation.
2. Each store notification marks the watch pending. At most one evaluation is pending per watch.
3. At evaluation time, read the latest local snapshot and run the selector.
4. Compare with the last delivered selection. Always deliver the first result.
5. Save the new selection before invoking the listener.

Synchronous updates before an evaluation coalesce. If a watched value changes from A to B and back to A before evaluation, there is no new delivery. Updates separated by asynchronous work can produce separate deliveries. This is observation, not an event log, a debounce timer, or a transaction spanning remote merges.

A listener may call `store.state.update`. A relevant resulting change schedules a later evaluation rather than recursively invoking that listener. Application code must avoid a loop where every delivery changes its own selection forever.

Stopping before an evaluation runs suppresses it, including the initial delivery. Stopping after work has started prevents future deliveries but does not cancel that work.

### Equality

Proposed default: use behavior equivalent to the current React equality helper.

- Start with `Object.is` for primitives and shared references.
- Compare array lengths, present indices, and elements recursively. Array order matters.
- Compare plain objects by their own enumerable string keys and values recursively.
- Other values use reference equality.

Recursive comparison supports acyclic data. Selectors should normally return schema data or acyclic projections. Selectors returning cyclic structures or specialized objects need a suitable custom comparator.

An optional `options.equal(previous, next)` overrides comparison after the first result. Equal results keep the last delivered selection as the baseline. This avoids notifying just because `filter` or `map` allocated a new array.

For the first version, rerun selectors on every store notification and compare their results. Dependency tracking and per-entity invalidation are not required. Equality lives in `@nn/node`; it must not depend on React just to use its helper.

### Errors and asynchronous callbacks

Proposed error policy: a synchronous exception in the selector, comparator, or listener stops that watch. If supplied, `options.onError(error: unknown)` receives the error once. Without a handler, surface the error through the runtime's uncaught-exception mechanism from the scheduled evaluation. Do not throw through the store update that caused the evaluation or route it through a sync engine's error channel. Each watch schedules independently, so one watch's handler does not run inside another's delivery.

Listeners are synchronous notification callbacks. Returned values, including promises, are not awaited or managed. The agent must handle rejection, cancellation, and concurrency for the work it starts. An exception thrown by `onError` is an application error and is not retried.

## Sync engines and readiness

`watch` runs independently of engine state. Local edits and incoming merges both schedule evaluation. Attaching no engines is valid, as is attaching several compatible engines for network and local persistence.

An application that needs synchronized data before starting work must wait for its chosen engine to finish the initial pull and merge. If several engines contribute required startup data, the application chooses which ones must be ready. A client cannot infer that policy from the store alone.

For agent integration, propose an additive public lifecycle notification on `SyncEngine`, with a readable current status and transitions sufficient to observe connection readiness and disconnection without replacing its internal delegate. The exact API belongs in the implementation plan. Readiness means the connection's initial pull and merge completed; it does not mean outgoing writes were acknowledged, all replicas agree, or future updates will arrive as one atomic snapshot.

On a lost connection, the example reviewer pauses new work. When the application or engine reestablishes synchronization, the reviewer resumes from a fresh current-state selection. Stopping and recreating a watch after readiness provides an initial delivery even if the merged data did not change. Results from earlier work must still be checked before publication.

Automatic transport reconnection is outside `watch` and the Node package. Integration must use the actual network engine's recovery policy; it cannot assume the current base session retries.

Filesystem and SQLite engines remain future adapters. The client does not require durable local storage. Unsynced in-memory changes can be lost when the process exits unless an attached persistence engine saved them.

## Example agent behavior

Build the demonstration in `apps/example-agent`, a private workspace application named `example-agent`. Move the board schema into a shared application package imported by both `example-react` and `example-agent`. Add comments, review status, and completion data there, not in `@nn/node`.

A description reviewer selects ticket IDs and descriptions whose current content has not been reviewed. It receives the full matching selection, not a per-ticket event. Its own worker tracks in-progress reviews by ticket and input version.

A completion record identifies the agent, ticket, and reviewed input. It must distinguish no completed review from a review of an empty description. Storing the reviewed content or a stable content fingerprint are both possible application representations. The agent checks whether the ticket still qualifies and whether its input is still current before publishing findings. Comments and completion records are written through a local store update; remote atomic delivery is not implied.

An agent watching a review column uses the same pattern. If a ticket enters and leaves review while the agent is disconnected, it does no work for that historical transition. A repeat review request for unchanged content may need an application-level review-request identifier; the generic client does not infer one from column movement.

The first demonstration uses one worker per agent identity. Persisted completion records prevent ordinary repeats after successful synchronization and restart, but CRDT merging does not provide exclusive job claims or exactly-once external execution. Multiple concurrent workers and distributed work claiming need a separate application design.

## Delivery boundaries

This is a small library project with a companion application integration. Plan it in these boundaries:

1. `@nn/node`: `watch` behavior, public types, and focused tests using controlled stores and engines.
2. Sync readiness: the additive lifecycle surface needed by headless consumers, checked against the current engine implementation.
3. `apps/example-agent`: shared schema and the Node agent application, once a Node-compatible network sync engine and the board's comment/review data are available.

The first two pieces can be built without selecting an AI provider or implementing a new persistence engine. The third proves browser-independent collaboration but has explicit prerequisites; adding `watch` alone does not deliver remote agent access end to end.

Use the repository's Node baseline, source export maps, package naming, and TypeScript rules. Consumer-visible public package changes need Changesets. This design document itself does not change a public package.

## Acceptance criteria

- A shared schema infers read and update types without application type casts.
- A Node program can create a `Store` without React or browser-only storage and use the existing `state.read` and `state.update` API.
- Compatible engines attach directly to it, and incoming merges notify `store.updates` subscribers.
- Asynchronous work and error handling remain owned by application code.
- Readiness can be observed without treating default or partially restored state as a completed initial pull, and without implying delivery acknowledgement.
- `example-agent` attributes findings to its agent and bases work on current state after reconnecting.

## Left to the implementation plan

- Internal modules, generic helper types, and test fixtures.
- The exact additive sync lifecycle API and compatibility work needed in existing engines.
- The shared example-schema package name and its concrete comment/completion schema.
- The network engine integration and how `example-agent` launches and supervises its Node process.
- The example AI provider and prompt, or a deterministic reviewer used to demonstrate client integration first.

The `watch` defaults described above were approved and later removed. The linked plans turn those decisions into implementation tasks.
