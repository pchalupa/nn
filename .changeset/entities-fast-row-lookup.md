---
"@nn/entities": major
---

Stores `Collection` rows by key, so `find`, `remove` and `merge` no longer scan the whole collection. On a 10k-row collection, 10k lookups drop from about 100 ms to under 1 ms.

Keys in a collection have to be unique. The constructor, `push` and `replace` throw `DuplicateKeyError` when two rows share a key, and leave the collection unchanged. Import the error from `@nn/entities/errors/DuplicateKeyError`.

`Collection.current` now returns a frozen copy of the rows instead of the live array. The copy stays the same object until a row is added or removed, so edits inside a row keep it stable. Mutating the array no longer works; use `push`, `remove` or `replace` instead:

```ts
// Before
collection.current.push(row);

// After
collection.push(row);
```
