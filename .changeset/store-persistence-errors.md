---
"@nn/store": minor
---

Adds an `error` event to the store, reporting writes the repository refused.

Persistence runs outside the call that triggered it, so a rejected `Repository.set` used to surface as an unhandled rejection. The store now catches it and hands it to the application:

```ts
store.events.on("error", (error) => {
	console.error("Failed to persist", error);
});
```
