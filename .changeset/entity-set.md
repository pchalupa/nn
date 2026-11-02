---
"@nn/entities": minor
---

Adds `Entity.set(updater)`, one method every entity shares for writing without an assignment.

```ts
language.set((current) => (current === "cs" ? "en" : "cs"));
```

The updater receives the current value and returns the next one, so a write always reads from the current state. Assigning to `current` keeps working.
