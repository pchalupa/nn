import { isObject } from "@nn/guards/is-object";
import { array, boolean, object, string } from "@nn/schema";
import { describe, expect, it } from "vitest";

import { State } from "./state";
import { Store } from "./store";

function call(target: unknown, method: string, ...args: unknown[]): unknown {
	const fn: unknown = isObject(target) ? target[method] : undefined;

	if (typeof fn !== "function") throw new Error(`Benchmarks need Node.js to provide ${method}.`);

	return Reflect.apply(fn, target, args);
}

function measure(target: unknown, method: string, field: string): number {
	const result = call(target, method);
	const value = isObject(result) ? result[field] : undefined;

	if (typeof value !== "number") throw new Error(`Benchmarks need Node.js to report ${field}.`);

	return value;
}

const process: unknown = Reflect.get(globalThis, "process");
const v8 = call(process, "getBuiltinModule", "node:v8");

call(v8, "setFlagsFromString", "--expose-gc");

const context = call(call(process, "getBuiltinModule", "node:vm"), "runInNewContext", "globalThis");

const schema = object({
	tickets: array(object({ title: string(), done: boolean(), assignee: object({ name: string() }) })),
});

function rows(size: number) {
	return Array.from({ length: size }, (_, index) => ({
		title: `Ticket ${index}`,
		done: false,
		assignee: { name: "Ann" },
	}));
}

describe("Memory with 10000 rows", () => {
	const size = 10_000;

	it("retains at most 1,400 bytes per row after a read", () => {
		call(context, "gc");
		call(context, "gc");

		const before = measure(process, "memoryUsage", "heapUsed");
		const state = new State(schema);

		state.update((draft) => {
			draft.tickets = rows(size);
		});
		state.read();
		call(context, "gc");
		call(context, "gc");

		expect((measure(process, "memoryUsage", "heapUsed") - before) / size).toBeLessThan(1_400);
		expect(state.read().tickets).toHaveLength(size);
	});

	it("allocates at most 24 MB for a one-field update and read", () => {
		const state = new State(schema);

		state.update((draft) => {
			draft.tickets = rows(size);
		});
		state.read();

		const samples = Array.from({ length: 20 }, (_, index) => {
			const before = measure(v8, "getHeapStatistics", "total_allocated_bytes");

			state.update((draft) => {
				draft.tickets[0].done = index % 2 === 0;
			});
			state.read();

			return measure(v8, "getHeapStatistics", "total_allocated_bytes") - before;
		});

		expect(Math.min(...samples.slice(10))).toBeLessThan(24 * 1024 * 1024);
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
	{ size: 100, updateFloor: 0, rebuildFloor: 0 },
	{ size: 10_000, updateFloor: 70, rebuildFloor: 1_600 },
])("Root snapshots with $size rows", ({ size, updateFloor, rebuildFloor }) => {
	const lastIndex = size - 1;

	it("measures root reconciliation for nested updates", async ({ bench }) => {
		const state = new State(schema);
		let name = "Ann";

		state.update((draft) => {
			draft.tickets = rows(size);
		});

		const result = await bench.compare(
			bench("changed nested field", () => {
				name = name === "Ann" ? "Bob" : "Ann";
				state.update((draft) => {
					draft.tickets[lastIndex].assignee.name = name;
				});
			}),
			bench("equal nested field", () =>
				state.update((draft) => {
					draft.tickets[lastIndex].assignee.name = name;
				})),
			{ time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 },
		);

		expect(result.get("changed nested field").throughput.mean).toBeGreaterThan(updateFloor);
		expect(state.read().tickets).toHaveLength(size);
		expect(state.read().tickets[0].title).toBe("Ticket 0");
	});

	it("measures cached reads and full-root rebuilds", async ({ bench }) => {
		const state = new State(schema);
		let rebuilt = 0;

		state.update((draft) => {
			draft.tickets = rows(size);
		});
		state.read();

		const result = await bench.compare(
			bench("cached collection", () => state.read().tickets),
			bench("cached last row", () => state.read().tickets[lastIndex]),
			bench(
				"row read rebuilding the root",
				{
					beforeEach: () =>
						state.update((draft) => {
							draft.tickets[lastIndex].title = `Changed ${rebuilt++}`;
						}),
				},
				() => state.read().tickets[lastIndex],
			),
			{ time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 },
		);

		expect(result.get("row read rebuilding the root").throughput.mean).toBeGreaterThan(rebuildFloor);
		expect(state.read().tickets).toHaveLength(size);
		expect(state.read().tickets[lastIndex].title).toBe(`Changed ${rebuilt - 1}`);
	});
});

describe("Update scaling", () => {
	it("keeps a one-field update at 10,000 rows under 20 times its cost at 1,000 rows", async ({ bench }) => {
		const small = new State(schema);
		const large = new State(schema);
		let name = "Ann";

		small.update((draft) => {
			draft.tickets = rows(1_000);
		});
		large.update((draft) => {
			draft.tickets = rows(10_000);
		});

		const result = await bench.compare(
			bench("update at 1,000 rows", () => {
				name = name === "Ann" ? "Bob" : "Ann";
				small.update((draft) => {
					draft.tickets[0].assignee.name = name;
				});
			}),
			bench("update at 10,000 rows", () => {
				name = name === "Ann" ? "Bob" : "Ann";
				large.update((draft) => {
					draft.tickets[0].assignee.name = name;
				});
			}),
			{ time: 0, iterations: 128, warmupTime: 0, warmupIterations: 32 },
		);
		const smallMean = result.get("update at 1,000 rows").latency.mean;
		const largeMean = result.get("update at 10,000 rows").latency.mean;

		expect(largeMean / smallMean).toBeLessThan(20);
		expect(result.get("update at 10,000 rows").throughput.mean).toBeGreaterThan(70);
	});
});
