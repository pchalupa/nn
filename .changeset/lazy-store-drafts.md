---
"@nn/store": major
---

Make `Store.update` much faster on large stores. The draft a recipe receives is now built only as far as the recipe reads it, and applying it skips every part the recipe did not write. At 10,000 rows, changing one field of one row drops from about 2.9 ms to about 10 µs, and rebuilding a collection with `map` while keeping its rows gets about 40% faster.

Drafts are now proxies rather than plain copies, which changes a few things a recipe can observe:

- `structuredClone` of a draft object throws a `DataCloneError`. Copy it instead, along with each nested object and array, for example `{ ...draft.tickets[0], assignee: { ...draft.tickets[0].assignee } }`.
- `console.log` of a draft object the recipe hasn't read yet prints `Proxy` instead of its data, and a logged draft collection shows internal entities for rows the recipe hasn't read.
- Spreading or serializing every row of a large collection inside a recipe, for example `draft.tickets.map((ticket) => ({ ...ticket }))`, is about twice as slow as before.
- A draft kept after its update has finished shows the store's later state for any part the recipe never read.
- An `update` called inside another recipe keeps its writes, unless the outer recipe already read the containing object before the inner update ran and then changed something inside it. Before, the outer update always overwrote them.
