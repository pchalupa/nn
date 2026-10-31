---
"@nn/event-emitter": major
---

`Observable` is now a delegate slot, `Observable<Delegate>`, instead of a `subscribe` contract. The `Callback` type is removed; `Unsubscribe` stays.

```ts
class Producer implements Observable<ProducerDelegate> {
	public delegate?: ProducerDelegate;
}
```
