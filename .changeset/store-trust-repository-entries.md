---
"@nn/store": major
---

Decodes repository entries before checking whether their keys match the target state field. Missing entries are ignored; any other stored value that is not a valid encoded entity throws. Decoded entities with mismatched keys are ignored when merging into state.

Ensure repository entries contain valid encoded entities before restoring a store. Invalid entries and unknown entity kinds now throw instead of falling back to the schema defaults, including entries stored under another key.
