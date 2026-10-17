# Time.epoch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give schema defaults a canonical `Time.epoch` timestamp without changing ordinary register creation into initialization.

**Follow-up:** The user requested `Time.epoch()` as a factory, like `Time.now()`, and a UUID-format replica ID. This supersedes the singleton API below: each call returns a fresh `Time(0, 0, "00000000-0000-0000-0000-000000000000")`, with identical comparison and serialization behavior. Callers and tests use the factory.

**Architecture:** Keep `LWWRegister`'s constructor default at `Time.now()`. Add a shared epoch timestamp to `Time`, pass it explicitly in `State.fromSchema()`, and remove `LWWRegister.initial()`. Persistence continues to preserve and observe saved timestamps before merging.

**Tech Stack:** TypeScript, pnpm, Vitest, Changesets.

**Spec:** The agreed design is recorded below from the conversation; no separate design document is needed for this small change.

## Agreed design

- `new LWWRegister(value, key)` represents a first write with actual time.
- Schema-derived register defaults use `new LWWRegister(value, key, Time.epoch)`.
- Explicit timestamps remain supported for restoring existing values.
- Assigning `current` continues to mint a timestamp and emit a change.
- Remove `LWWRegister.initial()` rather than retain a compatibility alias.
- Different untouched default values for the same key are invalid input. Do not add runtime validation or a tie-breaking policy for them.
- Do not change collection initialization, timestamp observation, merge notification behavior, or equal-value suppression in `State.assign()`.

## Global Constraints

- Preserve existing staged, unstaged, and untracked work. Several target files already contain user changes.
- Do not use TypeScript type casts (`as Type` or `<Type>value`).
- `any` is prohibited. Type values of unknown shape as `unknown` and narrow them before use.
- Avoid code comments.
- Add a Changeset for consumer-visible changes to public `@nn/*` packages.
- Never run `git commit` or post replies to PR comments unless the user explicitly asks for it.
- Use physical time `0`, counter `0`, and the nil UUID as replica ID. The canonical string is `1970-01-01T00:00:00.000Z+00000+00000000-0000-0000-0000-000000000000`.
- Epoch is the Unix epoch, not a new minimum sentinel below all supported historical timestamps. Do not alter timestamp comparison or parsing.

## Review Focus

- Independent module instances must serialize epoch identically, without the generated replica ID affecting it (Task 1).
- Reading epoch must not tick the clock or allocate a fresh timestamp on each access (Task 1).
- Ordinary constructors and collection row creation must still mint timestamps (Tasks 2 and 3).
- Persisted timestamps, including epoch, must survive restore and capture unchanged (Task 3).
- A first assignment must leave epoch even if its value equals the default; the store's existing equal-value no-op is unchanged (Task 2).

---

## File map

| File                                           | Responsibility                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/time/src/Time.ts`                    | Expose the canonical epoch timestamp                                                |
| `packages/time/src/Time.test.ts`               | Verify epoch identity, serialization, ordering, and clock behavior                  |
| `packages/entities/src/LWWRegister.ts`         | Remove the redundant factory; retain constructor and setter behavior                |
| `packages/entities/src/LWWRegister.test.ts`    | Use explicit epoch defaults and pin creation/write semantics                        |
| `packages/store/src/State.ts`                  | Pass epoch for schema-derived registers                                             |
| `packages/store/src/State.persistence.test.ts` | Pin canonical defaults and persistence behavior; migrate hand-built default fixture |
| `.changeset/canonical-time-epoch.md`           | Describe the API addition and migration                                             |

### Task 1: Add canonical Time.epoch (complete)

**Interfaces:** Produces `Time.epoch: Time`, a public static readonly singleton. All existing `Time` methods remain available.

- [ ] **Step 1: Add epoch tests in `packages/time/src/Time.test.ts`.** Assert `getTime() === 0`, `getCounter() === 0`, exact canonical serialization, repeated-access identity, `Time.fromTimestamp(Time.epoch.toString()).compare(Time.epoch) === 0`, and `Time.now().isAfter(Time.epoch) === true`. Spy on `Date.now` after import and assert reading/serializing epoch does not call it. Add an isolated module-reset test using the existing observation-test pattern: epoch strings from two fresh imports match and their timestamps compare equal. Keep module resets outside the concurrent tests.
- [ ] **Step 2: Run `pnpm test packages/time/src/Time.test.ts`.** Expect failure because `Time.epoch` does not exist.
- [ ] **Step 3: Implement `public static readonly epoch: Time = new Time(0, 0, "epoch")` in `packages/time/src/Time.ts`.** Make the three instance constructor properties readonly to model timestamp immutability; leave mutable `GlobalTime` fields unchanged. No new exports or dependencies are required.
- [ ] **Step 4: Run `pnpm test packages/time/src/Time.test.ts` and `pnpm --filter @nn/time ts:check`.** Both must pass, including existing parsing and observation tests.

### Task 2: Replace the register factory with explicit epoch construction (complete)

**Interfaces:** Consumes `Time.epoch: Time`. Keeps `constructor(value: Value, key?: string, timestamp = Time.now())` and removes `LWWRegister.initial`.

- [ ] **Step 1: Migrate the four factory fixtures in `packages/entities/src/LWWRegister.test.ts` to `new LWWRegister("default", "language", Time.epoch)`.** Strengthen the no-minting test to assert timestamp identity with `Time.epoch`. Retain both merge directions and their listener assertions.
- [ ] **Step 2: Add regression tests in that file.** Spy on `Time.now()` before ordinary construction and assert exactly one call and identity with its returned timestamp. For an epoch register, assign the same default value directly through `current`; assert exactly one `Time.now()` call, a timestamp after epoch, and one change notification.
- [ ] **Step 3: Run `pnpm test packages/entities/src/LWWRegister.test.ts`.** These behavior-preserving tests should pass; factory removal is an API cleanup, so do not invent a runtime failure to satisfy a red-test step.
- [ ] **Step 4: Remove only `LWWRegister.initial()` from `packages/entities/src/LWWRegister.ts`.** Leave the constructor default, setter, merge algorithm, and explicit timestamp handling unchanged.
- [ ] **Step 5: Run `pnpm test packages/entities/src/LWWRegister.test.ts`.** All register tests must pass. Workspace type checking waits until the store callers are migrated in Task 3.

### Task 3: Use canonical epoch for schema defaults and verify integration (complete)

**Interfaces:** Consumes the unchanged register constructor and `Time.epoch`. `State.fromSchema()`, `State.fromEntries()`, and persisted entry formats remain unchanged.

- [ ] **Step 1: Update `packages/store/src/State.persistence.test.ts`.** Replace the epoch-prefix fixture with the exact canonical string from Task 1 and replace the remaining `initial()` fixture with `new LWWRegister<string | undefined>(undefined, "language", Time.epoch)`. Assert schema creation with no persisted data never calls `Time.now()` and captures the exact epoch string. Add an epoch capture/restore round-trip test asserting exact entry equality and no minting. Keep existing written-value restore and future-clock tests.
- [ ] **Step 2: Strengthen integration assertions.** In the root capture test, verify newly inserted collection rows have timestamps after epoch by parsing their captured register timestamps. Add a schema register write test: writing `"cs"` replaces epoch with a timestamp after it. Keep the existing hand-built merge test to prove a saved write wins over an epoch default. Use metadata-kind narrowing instead of casts when reading captured timestamps.
- [ ] **Step 3: Run `pnpm test packages/store/src/State.persistence.test.ts`.** Expect canonical-default tests to fail while `State.fromSchema()` still calls the removed factory.
- [ ] **Step 4: Import `Time` from `@nn/time` in `packages/store/src/State.ts` and replace its factory call with `new LWWRegister(normalize(shape, undefined), name, Time.epoch)`.** Do not modify persistence restoration or collection reconciliation.
- [ ] **Step 5: Run `pnpm test packages/time/src/Time.test.ts packages/entities/src/LWWRegister.test.ts packages/store/src/State.persistence.test.ts`.** All targeted tests must pass.
- [ ] **Step 6: Load the changeset-authoring skill and add `.changeset/canonical-time-epoch.md`.** Include `@nn/time`, `@nn/entities`, and `@nn/store`. Follow repository versioning conventions after inspecting current Changesets and whether `initial()` has shipped. Explain migration from `LWWRegister.initial(value, key)` to `new LWWRegister(value, key, Time.epoch)` and that ordinary constructors still use current time. Preserve existing Changesets.
- [ ] **Step 7: Run `pnpm test`, `pnpm ts:check`, `pnpm lint:check`, and `pnpm format:check`.** Report pre-existing failures separately; do not broaden the patch to repair unrelated user work. Search executable source for `LWWRegister.initial` and confirm no references remain.
- [ ] **Step 8: Review the scoped diff.** Confirm only the planned runtime changes were made, no user work was discarded, and no commit was created. Summarize verification results for the user.

## Execution handoff

This is one small, sequential change. Native execution in this session is recommended; the tasks share the same timestamp interface and do not benefit from parallel implementation. Review this plan before starting implementation.
