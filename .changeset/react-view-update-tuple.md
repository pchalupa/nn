---
"@nn/react": major
---

`useStore` returns a `[view, update]` pair of plain data and an updater, instead of the live entity.

A component used to receive the entity itself, read it through `.current`, and write to the same object it rendered. Reads and writes now have separate paths, and the value a component holds is frozen plain data.

```tsx
// Before
const tickets = useStore((store) => store.tickets.filter((ticket) => ticket.status === status));

tickets.push({ id, title, status });

// After
const [tickets, update] = useStore((store) => store.tickets.filter((ticket) => ticket.status === status));

update((draft) => {
	draft.push({ id, title, status });
});
```

A register works the same way, and its view is the value itself:

```tsx
// Before
const language = useStore((store) => store.language);

language.current; // "cs"
language.set(() => "en");

// After
const [language, setLanguage] = useStore((store) => store.language);

language; // "cs"
setLanguage(() => "en");
```

Two fixes come with it. The selector is read fresh on every render, so a selector that closes over a prop no longer keeps filtering by the value it had at mount. And `getServerSnapshot` is passed, so rendering on the server no longer throws.
