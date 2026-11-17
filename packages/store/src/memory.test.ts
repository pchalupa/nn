import { getHeapStatistics } from "node:v8";

import { array, boolean, object, string } from "@nn/schema";
import { describe, expect, it } from "vitest";

import { Store } from "./store";

describe("Memory", () => {
	function populate() {
		const store = new Store(object({ tickets: array(object({ title: string(), done: boolean() })) }));

		store.update((draft) => {
			draft.tickets = Array.from({ length: 1_000 }, (_, index) => ({ title: `Ticket ${index}`, done: false }));
		});
		store.read();

		return store;
	}

	it("allocates at most 1 MB for a one-field update and read", () => {
		const store = populate();
		const samples = Array.from({ length: 10 }, () => {
			const before = getHeapStatistics().total_allocated_bytes;

			store.update((draft) => {
				draft.tickets[0].done = !draft.tickets[0].done;
			});
			store.read();

			return getHeapStatistics().total_allocated_bytes - before;
		});

		expect(Math.min(...samples)).toBeLessThan(1024 * 1024);
	});

	it("sends a one-field change", () => {
		const store = populate();
		let bytes = 0;

		store.onChange((changes) => {
			bytes = JSON.stringify(changes).length;
		});
		store.update((draft) => {
			draft.tickets[0].title = "Changed";
		});

		expect(bytes).toMatchInlineSnapshot(`395969`);
	});
});
