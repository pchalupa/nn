# @nn/cache

Caches for values derived from other state.

## Installation

```sh
npm install @nn/cache
```

## Usage

```ts
import { InvalidatableCache } from "@nn/cache/invalidatable-cache";

const prices = [3, 5, 8];
const cachedTotal = new InvalidatableCache<number>();
const total = () => prices.reduce((sum, price) => sum + price, 0);

cachedTotal.ensure(total);
prices.push(13);
cachedTotal.invalidate();
cachedTotal.ensure(total);
```

`ensure` returns the stored value, or calls the loader once and stores the result. Pass the loader on every call; the cache never runs it on its own. Any value can be cached, including `undefined` and `null`.

### Cache a value its owner invalidates

Use `InvalidatableCache` when the owner knows the moments its source changes. Invalidate it in the method that makes the change.

```ts
import { InvalidatableCache } from "@nn/cache/invalidatable-cache";

class List<Item> {
	private items = new Map<string, Item>();
	private readonly cachedItems = new InvalidatableCache<readonly Item[]>();

	public get rows(): readonly Item[] {
		return this.cachedItems.ensure(() => Array.from(this.items.values()));
	}

	public add(key: string, item: Item): void {
		this.items.set(key, item);
		this.cachedItems.invalidate();
	}
}
```

### Cache a value per object version

Use `VersionedCache` when the value derives from an object that counts its own changes. It keeps one value per object, held in a [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), and loads it again when the version differs from the stored one.

```ts
import { VersionedCache } from "@nn/cache/versioned-cache";

interface Note {
	text: string;
	revision: number;
}

const cachedSummaries = new VersionedCache<Note, string>();
const summarize = (note: Note) => note.text.slice(0, 80);
const note: Note = { text: "Pick up groceries on the way home", revision: 1 };

cachedSummaries.ensure(note, note.revision, summarize);
```
