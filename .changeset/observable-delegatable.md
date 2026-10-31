---
"@nn/observable": major
---

`Observable` is renamed `Delegatable`. It only declares the `delegate` slot, so the new name no longer suggests observer-style notification.

```ts
class Producer implements Observable<ProducerDelegate> {} // before
class Producer implements Delegatable<ProducerDelegate> {} // after
```
