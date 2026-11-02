---
"@nn/react": major
---

`use(store)` returns two hooks, `useRead` for reads and `useUpdate` for writes, instead of handing components the live entity.

A component used to receive the entity itself, read it through `.current`, and write to the same object it rendered. Reads and writes now have separate hooks. `useRead(selector)` returns frozen plain data. `useUpdate()` returns a stable updater and never subscribes, so a component that only writes does not re-render when the state changes.

```tsx
const { useRead, useUpdate } = use(store);

const tickets = useRead((data) => data.tickets.filter((ticket) => ticket.status === status));
const update = useUpdate();

update((draft) => {
	draft.tickets.push({ id, title, status });
});
```

A register works the same way, and its value is the value itself:

```tsx
const language = useRead((data) => data.language);
const update = useUpdate();

language; // "cs"
update((draft) => {
	draft.language = "en";
});
```

Two fixes come with it. The selector is read fresh on every render, so a selector that closes over a prop no longer keeps filtering by the value it had at mount. And `getServerSnapshot` is passed, so rendering on the server no longer throws.
