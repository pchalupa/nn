---
"@nn/repository": major
"@nn/indexdb-repository": minor
---

Adds `delete` to the `Repository` interface, so a record can be removed by its id.

Until now a repository could only grow. Removing a record from a collection left the stored copy behind, and it came back on the next load.

```ts
await repository.delete("ticket-1", "tickets");
```

Every `Repository` implementation has to add it.
