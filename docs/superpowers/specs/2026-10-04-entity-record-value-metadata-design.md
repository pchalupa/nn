# Common entity record value and metadata

Status: deferred for review after view materialization. The common shape and nested child records were approved in conversation on 2026-10-04, then the user requested reverting the record implementation too. This document preserves the proposed format; `EntityRecord`, `toRecord()` and `fromRecord()` are not currently implemented. The suggestion to use `toJSON()` for records remains open.

## Goal

Every entity record has a common `value` field. CRDT bookkeeping belongs in `metadata`, alongside the existing `kind` and `key` identity fields. Composite values contain child entity records, keeping each child's value and metadata together.

Saving and restoring a root must preserve its subsequent merge behavior, including order, timestamps, retired anchors and deletions. We keep one complete record per root, captured and restored through `toRecord()` and `fromRecord()`.

## Common container

`EntityRecord<Kind>` remains one generic class. Its four data properties are:

| Property   | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `kind`     | Entity kind used by the restoration dispatcher |
| `key`      | Entity identity                                |
| `value`    | Register payload or composite child records    |
| `metadata` | Entity-specific CRDT bookkeeping               |

Use `new EntityRecord(kind, key, value, metadata)`. The value argument is required and may explicitly be `undefined`. Metadata defaults to an empty object for entities with no bookkeeping of their own. Remove the arbitrary top-level field index signature; general containers expose `value` as `unknown` and `metadata` as `Record<string, unknown>`.

The constructor captures `value` and `metadata` with one shared clone context. It preserves supported cycles, aliases, sparse arrays and special property names across both fields. Actual nested `EntityRecord` instances retain their class during capture. `Time` instances in either field become strings through `Time.toString()`. Shared-memory payloads remain unsupported because they cannot produce detached snapshots.

`EntityRecord.fromObject()` accepts a container or a plain structured-clone result. It validates string identity fields, an own `value` property and an own plain-object `metadata` property, then captures the four fields into a detached container. It rejects extra top-level fields instead of silently discarding state. It does not infer nested entity records from arbitrary payload objects.

Entity factories validate their own value and metadata shapes. Registers continue accepting the general container and restoring an unknown-valued register. Map and RGA interfaces can narrow the common properties without adding record subclasses. All input narrowing follows the repository's rules against type casts and `any`.

## Entity formats

### Register

```ts
new EntityRecord("register", key, payload, { timestamp });
```

`value` contains the stored payload. `metadata.timestamp` contains the captured timestamp string. Register decoding validates it through `Time.fromTimestamp()`.

Payload objects remain ordinary data even when they contain `kind`, `key`, `value` or `metadata` properties. Entity decoding never recursively interprets a register payload as a child entity.

### Map

```ts
new EntityRecord(
	"map",
	key,
	{
		title: title.toRecord(),
		done: done.toRecord(),
	},
	{},
);
```

`value` replaces the former top-level `fields` property. It maps field names to child records. Metadata is an empty object because the current map owns no additional merge state. Child records preserve their own identities and bookkeeping.

The map factory validates the field dictionary and restores each child through the supplied decoder. Field names such as `__proto__` remain ordinary own properties.

### RGA

`value` is an array of live child records in sequence order. Metadata contains:

- `clock`: the sequence clock string.
- `elements`: every retained insertion in the existing sequence order, including retired and superseded insertions.
- `tombstones`: row keys mapped to removal timestamp strings.

Each metadata element has this shape:

```ts
{
  id: { time, key },
  after,
  rowKey,
  removedAt,
}
```

`after` is an optional insertion ID. `removedAt` is an optional timestamp. `rowKey` is present only when the element holds a live row and references that child's key in `value`. The key must equal `id.key`. Retired elements omit `rowKey` but retain their identity, anchor and any removal timestamp.

The explicit row reference matters because several historical insertions may share a key. Decoding must recover exactly which insertion holds the live row without selecting a winner again. Each live child is serialized once, in `value`; metadata holds no duplicated child payloads.

## Restoration and validation

Restoration installs captured state directly and rebuilds indexes and subscriptions. It does not call mutation methods that mint new timestamps or insertion IDs.

For an RGA, decoding first validates the child records and builds a key lookup. It then restores metadata elements, resolving their optional `rowKey` references. Reject:

- Duplicate child keys, duplicate element IDs or multiple references to one live child.
- References to missing children, unreferenced children or a `rowKey` different from `id.key`.
- A live-child order different from the referenced-row order in `metadata.elements`.
- Malformed IDs, timestamps, tombstones or metadata structures.
- Self-anchors, clocks that precede recorded element or tombstone times, and the tombstone inconsistencies already rejected by the decoder.

Preserve anchors whose insertion has not arrived yet; delayed remote insertions can make those references meaningful. Validate the represented state rather than generating replacement history or sorting records by key. Empty sequences still retain metadata, including deletions and retired anchors.

## Repository and integration

IndexedDB continues storing one complete root through structured cloning and reconstructing only root containers on read. Update its root-record recognition to require all four common fields, so ordinary objects with only `kind` and `key` are not treated as complete records. Concrete entity decoders reconstruct child containers at the positions their formats define.

Store schema validation continues operating on restored entities. Explicit repository writes capture value and metadata together as one atomic root record. Automatic Store saves, `flush()` and Store-side projection filtering are deferred until view materialization is complete; their [follow-up plan](../plans/2026-10-03-crdt-root-snapshots.md#resume-after-view-materialization) must use the record shape agreed at implementation time. Existing change signals and batching apply to the new record shape.

This is a breaking record-format change. The former flat format is unsupported; we add no migration, legacy reader or format-version wrapper. Time conversion uses the delivered Time API, with no changes to timestamp representation or ordering.

## Alternatives

We chose nested child records because each child already owns its format and restoration rules. Plain projected values with a separate metadata tree would require matching two parallel structures and reconstructing child identities. Keeping arbitrary top-level fields would preserve the current inconsistency between register values, map fields and sequence elements.

## Verification

The main invariant is equal future merge behavior with and without a save/reload boundary. Update existing fixtures and retain stale-replica, deletion, delayed-anchor, superseded-insertion and metadata-only persistence coverage.

Add focused regressions for the RGA value-to-element references: same-key reinsertion, missing or duplicate references, unreferenced children and inconsistent value order. Verify that a sequence with no live rows round-trips its complete history.

Container checks cover an explicit undefined value, missing common properties, extra top-level fields, detachment, aliases across value and metadata, recursive Time conversion and payloads that resemble records. IndexedDB checks cover root reconstruction and unchanged arbitrary nested payloads. Existing persistence failure and transaction-abort regressions must continue passing.

Run the entity, Store and IndexedDB tests, workspace type checks, lint, formatting and spelling checks. Use the existing snapshot benchmarks to check the extra sequence lookup and ensure live payloads are captured only once.

## Documentation and release work

During implementation, record the replacement of arbitrary top-level record fields in a new ADR linked from [ADR-06](../../decisions/ADR-06-persist-entity-owned-root-records.md). Update the root-snapshot design and affected documentation to describe the four-field shape. Add Changesets for affected public contracts with the new constructor and storage format, and update the repository guide's ADR read triggers.
