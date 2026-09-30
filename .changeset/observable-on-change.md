---
"@nn/event-emitter": major
---

Renames `Observable.subscribe` to `Observable.onChange`. Update implementations and callers to use `onChange(callback)`. The callback and returned unsubscribe function keep the same signatures.
