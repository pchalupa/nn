# Sync Readiness Implementation Plan

> **Note:** `SyncEngine.status` and `SyncEngine.statusChanges` were removed after implementation. Consumers read `engine.session.state` and subscribe to `engine.session.changes`; see the amendment in ADR-16.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let consumers observe initial synchronization and interruptions so background agents act only after the relevant engine has restored its current snapshot.

**Architecture:** Add observable lifecycle transitions to the existing session and expose them through the engine without replacing its internal delegate. Make SSE interruptions enter a reconnecting state immediately, with readiness returning only after the replacement snapshot merges.

**Tech Stack:** Existing TypeScript `Session`, `SyncEngine`, `Observable`, `SseSync`, and Vitest.

**Spec:** [Approved Node client design](../specs/2026-11-05-node-client-design.md), especially Sync engines and readiness.

## Global Constraints

- Readiness means the connection's initial pull and merge completed; it does not mean outgoing writes were acknowledged.
- Keep asynchronous work, concurrency, cancellation, retries, and agent instructions in the agent program.
- `watch` runs independently of engine state.
- No type casts, `any`, code comments, or automatic commits. Preserve the existing session transition rules.
- Add Changesets for consumer-visible public package changes.

## Review Focus

- A delayed or failed second field pull must never announce readiness after only the first field: Task 1.
- A late open result after detach must not announce connected: Task 1.
- Connected observers must run after engine subscription setup so their immediate writes are published: Task 1.
- EventSource automatic reconnects must not leave an agent believing its data is current: Task 2.
- Detaching during the reconnect delay must cancel the timer and prevent a replacement stream: Task 2.

---

## File map and dependency

This plan can run independently of the Node library plan. It changes `packages/sync-engine/src/session.ts` and `sync-engine.ts` with adjacent tests, and `packages/sse-sync/src/event-stream.ts` and `sse-sync.ts` with adjacent tests. Update both package READMEs and add one Changeset. Existing `SseSync.open` already waits until the first stream message has been delivered and merged; preserve that property.

### Task 1: Observable engine status

**Files:** Modify `packages/sync-engine/src/session.ts`, `session.test.ts`, `sync-engine.ts`, and `sync-engine.test.ts`.

**Interfaces:** `Session.changes: Observable<[SessionState]>`; `SyncEngine.status: SessionState` as a getter; `SyncEngine.statusChanges` as the session's existing observable instance. Re-export `SessionState` from `@nn/sync-engine` through `src/sync-engine.ts`. A listener receives only the new status. The subscription itself does not deliver initially; consumers subscribe and then read `engine.status` synchronously.

- [ ] **Write session notification tests.** Assert `connecting`, `connected`, and `detached` are delivered once for actual transitions, ignored events emit nothing, and stop unsubscribes. A state listener must see `session.state` equal its argument. A listener that requests detach queues that transition without interrupting the current transition's effects. All notifications occur after the existing delegate effects for that transition.
- [ ] **Write readiness tests.** Use the existing deferred transport helper. Hold the second field's pull pending and assert status remains connecting after the first merges. Reject it and expect disconnected without connected. Resolve all pulls and expect connected with the restored values visible. Update the store inside a connected listener and assert the transport receives that update. A pending push must not delay connected. Detach while opening and resolve late; expect no subsequent connected notification. Verify the existing failure delegate still receives errors.
- [ ] **Run the failing tests.** Run `pnpm --filter @nn/sync-engine test`. Expect missing status/notification API failures.
- [ ] **Implement the lifecycle surface.** Add `Session.changes`, notifying once after delegate effects for each actual transition inside the existing event-processing queue. Expose `status` and `statusChanges` through the engine without additional state or subscriptions. Match existing Observable conventions; status observers must not throw. Preserve all existing transition rules and error handling.
- [ ] **Verify.** Run `pnpm --filter @nn/sync-engine test` and `pnpm --filter @nn/sync-engine ts:check`. Existing transition-table tests and new readiness assertions must pass.

### Task 2: SSE readiness across interruption

**Files:** Modify `packages/sse-sync/src/event-stream.ts`, `event-stream.test.ts`, `sse-sync.ts`, and `sse-sync.test.ts`.

**Consumes:** `SyncEngine.status/statusChanges`, existing `Session.reconnect`, and first-message bootstrap semantics.

**Produces:** A post-bootstrap stream interruption immediately changes engine status to connecting; a fresh initial message is required before connected returns. Keep the existing 3,000 ms delay before opening the replacement EventSource. The base session still does not retry failed initial connections automatically.

- [ ] **Write interruption tests.** Extend `FakeEventSource` to simulate both CONNECTING and CLOSED error states. After bootstrap, either must close the old stream and announce connecting immediately. Advance fake time by 2,999 ms and assert no replacement; advance 1 ms and assert a replacement opens. Connected must remain absent until its first valid snapshot is received and merged. Repeated old-stream errors must not create multiple timers or streams. An interruption before the first snapshot may retain EventSource's own retry behavior while status stays connecting.
- [ ] **Write cleanup tests.** Detach during the delay and after the replacement opens but before its snapshot; assert no late readiness and no remaining timers or live streams. A malformed first snapshot must fail the attempt without starting agent work. Existing normal incoming-update and push tests must still pass.
- [ ] **Run the failing tests.** Run `pnpm --filter @nn/sse-sync test`. Existing behavior should fail the immediate-readiness-invalidation assertions.
- [ ] **Implement interrupted-stream ownership.** Have `EventStream` report the first post-bootstrap error for either CONNECTING or CLOSED through its existing close callback, then clear that stream's callbacks. In `SseSync`, mark a delayed reopen and invoke `session.reconnect()` immediately. Its close effect closes the old source; the next `open(signal)` consumes the delay flag and waits 3,000 ms with abort-aware timer cleanup before calling `stream.open(signal)`. Remove the former timer that left session status connected during the wait. Explicit close must clear callbacks and cannot report another transport interruption.
- [ ] **Verify.** Run `pnpm --filter @nn/sse-sync test` and `pnpm --filter @nn/sse-sync ts:check`; no leaked timers, rejected promises, or stale callbacks are allowed.

### Task 3: Lifecycle documentation and compatibility

**Files:** Update `packages/sync-engine/README.md` and `packages/sse-sync/README.md`; create `.changeset/observable-sync-readiness.md`.

**Interfaces:** Document the Task 1 API and Task 2 timing without promising delivery acknowledgements or durable state.

- [ ] **Document subscription usage.** Show subscribe-then-read status, starting a new watch when connected, stopping it for other states, and detaching via the existing session lifecycle. Explain that reconnect means a new initial snapshot and that application work must revalidate its input before publication.
- [ ] **Add the release entry.** Use a minor release for the additive `@nn/sync-engine` API and a patch for `@nn/sse-sync` correcting stale readiness during interruptions. Explain the retained 3,000 ms reconnect delay and that failed initial attempts still follow existing recovery policy.
- [ ] **Verify consumers.** Run `pnpm --filter @nn/sync-engine test`, `pnpm --filter @nn/sse-sync test`, `pnpm --filter @nn/indexdb-sync test`, `pnpm --filter @nn/broadcast-sync test`, and `pnpm ts:check`. Run scoped formatting, lint, spelling, and Changesets checks for the touched packages. Record unrelated existing failures separately.

## Handoff

The example-agent plan consumes this lifecycle API. This plan changes transport readiness, not the agent's job scheduling or the Node store's watch contract. Do not commit unless explicitly asked.
