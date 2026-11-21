---
"@nn/entities": major
---

`RGA.find(key)` is renamed to `RGA.get(key)`, matching `LWWMap.get`, and `RGA.map` is removed. To derive a list that keeps the removed keys, build it from the items and `tombstones`.

```ts
// Before
list.find(key);
list.map((item) => next(item));

// After
list.get(key);
new RGA(
	list.current.map((item) => next(item)),
	list.key,
	list.tombstones,
);
```
