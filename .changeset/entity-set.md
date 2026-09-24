---
"@nn/entities": minor
---

Adds `Entity.set(updater)`, one method every entity shares for writing without an assignment.

React Compiler refuses to compile a component that assigns to a value returned from a hook, so `language.current = value` made the whole component bail out of compilation and lose its memoization. A method call carries no such restriction:

```ts
const language = useStore((store) => store.language);

language.set((current) => (current === "cs" ? "en" : "cs"));
```

The updater receives the current value and returns the next one, so a write always reads from the current state. Assigning to `current` keeps working and stays the shorter option outside of React render paths.
