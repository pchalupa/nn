import { isObject } from "@nn/guards/is-object";
import { array, boolean, object, string } from "@nn/schema";
import { describe, expect, it } from "vitest";

import { Store } from "./store";

function call(target: unknown, method: string, ...args: unknown[]): unknown {
	const fn: unknown = isObject(target) ? target[method] : undefined;

	if (typeof fn !== "function") throw new TypeError(`Benchmarks need Node.js to provide ${method}.`);

	return Reflect.apply(fn, target, args);
}

function measure(target: unknown, method: string, field: string): number {
	const result = call(target, method);
	const value = isObject(result) ? result[field] : undefined;

	if (typeof value !== "number") throw new TypeError(`Benchmarks need Node.js to report ${field}.`);

	return value;
}

const process: unknown = Reflect.get(globalThis, "process");
const v8 = call(process, "getBuiltinModule", "node:v8");

call(v8, "setFlagsFromString", "--expose-gc");

const context = call(call(process, "getBuiltinModule", "node:vm"), "runInNewContext", "globalThis");

const schema = object({
	tickets: array(object({ title: string(), done: boolean(), assignee: object({ name: string() }) })),
});

function items(size: number) {
	return Array.from({ length: size }, (_, index) => ({
		title: `Ticket ${index}`,
		done: false,
		assignee: { name: "Ann" },
	}));
}

describe("Memory with 10000 items", () => {
	const size = 10_000;

	it("retains at most 1,400 bytes per item after a read", () => {
		call(context, "gc");
		call(context, "gc");

		const before = measure(process, "memoryUsage", "heapUsed");
		const store = new Store(schema);

		store.update((draft) => {
			draft.tickets = items(size);
		});
		store.read();
		call(context, "gc");
		call(context, "gc");

		expect((measure(process, "memoryUsage", "heapUsed") - before) / size).toBeLessThan(1_400);
		expect(store.read().tickets).toHaveLength(size);
	});

	it("allocates at most 1 MB for a one-field update and read", () => {
		const store = new Store(schema);

		store.update((draft) => {
			draft.tickets = items(size);
		});
		store.read();

		const samples = Array.from({ length: 20 }, (_, index) => {
			const before = measure(v8, "getHeapStatistics", "total_allocated_bytes");

			store.update((draft) => {
				draft.tickets[0].done = index % 2 === 0;
			});
			store.read();

			return measure(v8, "getHeapStatistics", "total_allocated_bytes") - before;
		});

		expect(Math.min(...samples.slice(10))).toBeLessThan(1024 * 1024);
	});
});

describe("Store", () => {
	it("constructs a store from schema", async ({ bench }) => {
		const blogSchema = object({
			users: array(object({ name: string() })),
			posts: array(object({ title: string() })),
		});

		const result = await bench("constructor", () => {
			const store = new Store(blogSchema);

			return store;
		}).run();

		expect(result.throughput.mean).toBeGreaterThan(500_000);
	});
});

describe.each([
	{ size: 100, updateFloor: 100_000, rebuildFloor: 50_000 },
	{ size: 10_000, updateFloor: 30_000, rebuildFloor: 1_600 },
])("Root snapshots with $size items", ({ size, updateFloor, rebuildFloor }) => {
	const lastIndex = size - 1;

	it("measures root reconciliation for nested updates", async ({ bench }) => {
		const store = new Store(schema);
		let name = "Ann";

		store.update((draft) => {
			draft.tickets = items(size);
		});

		const result = await bench.compare(
			bench("changed nested field", () => {
				name = name === "Ann" ? "Bob" : "Ann";
				store.update((draft) => {
					draft.tickets[lastIndex].assignee.name = name;
				});
			}),
			bench("equal nested field", () =>
				store.update((draft) => {
					draft.tickets[lastIndex].assignee.name = name;
				})),
			{ time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 },
		);

		expect(result.get("changed nested field").throughput.mean).toBeGreaterThan(updateFloor);
		expect(store.read().tickets).toHaveLength(size);
		expect(store.read().tickets[0].title).toBe("Ticket 0");
	});

	it("measures cached reads and full-root rebuilds", async ({ bench }) => {
		const store = new Store(schema);
		let rebuilt = 0;

		store.update((draft) => {
			draft.tickets = items(size);
		});
		store.read();

		const result = await bench.compare(
			bench("cached collection", () => store.read().tickets),
			bench("cached last item", () => store.read().tickets[lastIndex]),
			bench(
				"item read rebuilding the root",
				{
					beforeEach: () =>
						store.update((draft) => {
							draft.tickets[lastIndex].title = `Changed ${rebuilt++}`;
						}),
				},
				() => store.read().tickets[lastIndex],
			),
			{ time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 },
		);

		expect(result.get("item read rebuilding the root").throughput.mean).toBeGreaterThan(rebuildFloor);
		expect(store.read().tickets).toHaveLength(size);
		expect(store.read().tickets[lastIndex].title).toBe(`Changed ${rebuilt - 1}`);
	});
});

describe("Update scaling", () => {
	it("keeps a one-field update at 10,000 items under 8 times its cost at 1,000 items", async ({ bench }) => {
		const small = new Store(schema);
		const large = new Store(schema);
		let name = "Ann";

		small.update((draft) => {
			draft.tickets = items(1_000);
		});
		large.update((draft) => {
			draft.tickets = items(10_000);
		});

		const result = await bench.compare(
			bench("update at 1,000 items", () => {
				name = name === "Ann" ? "Bob" : "Ann";
				small.update((draft) => {
					draft.tickets[0].assignee.name = name;
				});
			}),
			bench("update at 10,000 items", () => {
				name = name === "Ann" ? "Bob" : "Ann";
				large.update((draft) => {
					draft.tickets[0].assignee.name = name;
				});
			}),
			{ time: 0, iterations: 128, warmupTime: 0, warmupIterations: 32 },
		);
		const smallMean = result.get("update at 1,000 items").latency.mean;
		const largeMean = result.get("update at 10,000 items").latency.mean;

		expect(largeMean / smallMean).toBeLessThan(8);
		expect(result.get("update at 10,000 items").throughput.mean).toBeGreaterThan(30_000);
	});
});
