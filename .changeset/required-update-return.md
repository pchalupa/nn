---
"@nn/store": major
"@nn/react": major
---

Update recipes now have to return the next value for their path. Returning `undefined` no longer falls back to the mutated draft. It is written as the value. TypeScript accepts it only where the path's type includes `undefined`. Collections and rows reject it with `WriteTargetError`.

TypeScript does not flag a missing return for paths whose type includes `undefined`, such as string registers. Check conditional callbacks on those paths: a branch without a return now writes `undefined`.

Mutation-style recipes return their draft:

```ts
update((draft) => {
	draft.push(ticket);
});
```

becomes:

```ts
update((draft) => {
	draft.push(ticket);
	return draft;
});
```

`Recipe` is now `(draft: Drafted) => Drafted`.
