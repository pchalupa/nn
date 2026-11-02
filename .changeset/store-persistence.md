---
"@nn/store": major
---

Persists each top-level field as one encoded entity under the field's name, using `Codec` from `@nn/entities`. The stored format changed and existing data is not migrated.

On startup, `Store.fromSchema` reads every field with `repository.get(name)`, decodes it and merges it into state. A missing entry is skipped. An entry whose key does not match the field is ignored. An entry that is not a valid encoded entity, or has an unknown kind, throws. Stored entries are not checked against the schema. A restored field that changes state is written back once.

After each change, the changed fields are written again. A failed write is logged with `console.error` and not retried; the `error` event is gone. Writes run independently, without ordering guarantees between updates.
