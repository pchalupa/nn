---
author: Petr Chalupa
date: 2026-10-02
---

# ADR-05: Batch Store notifications

## Context

One [`Store.update`](../../packages/store/src/Store.ts) recipe can produce several entity changes and entities report each change immediately. Store subscribers need to read the resulting state, while entity listeners and persistence callbacks receive individual changes.

## Decision

We use one [`Batch`](../../packages/store/src/Batch.ts) instance per Store to combine notification requests during patch application. Store owns its event emitter and subscriptions. Batch owns when a requested callback runs, without knowing about entities, persistence, or events.

`run(work)` executes work synchronously. Nested runs share the batch, and only the outermost exit handles the pending callback. `request(callback)` calls the callback immediately outside a run. Inside a run, it replaces the pending callback: the last request wins. A run with no requests calls nothing.

Store passes its update callback at the request site rather than binding it in the Batch constructor:

```ts
private batch = new Batch();

entity.subscribe(() => {
	this.batch.request(() => this.eventEmitter.emit("update"));
});
```

Every Store request means the same thing: subscribers should read the current state. Replacing earlier requests is therefore sufficient, even though each request creates a new function. Batch doesn't compare function identities or collect distinct tasks.

We use plain `try/finally` to restore the active-run count and handle pending work even when patch application throws.

## Alternatives considered

**Notify Store subscribers for every entity change.** This requires no batching helper, but subscribers would run repeatedly during a multi-operation patch and could read intermediate state. We keep one notification for the completed batch of changes instead.

## Consequences

Store has less notification bookkeeping, and nested updates can finish before subscribers are called. The [React adapter](../../packages/react/src/index.ts) continues using Store's subscription API and reads the state after patch application. Callers need no API migration.

Batch is suitable for requests where the latest callback replaces earlier ones. Using it for independent writes or tasks would discard work. Empty batches stay silent, but a change followed by its inverse can still notify: batching doesn't compare the initial and final state.
