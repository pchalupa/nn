import { array, boolean, object, string } from "@nn/schema";
import { describe, it } from "vitest";

import { Store } from "./store";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };

describe("Store", () => {
	const schema = object({
		tickets: array(object({ title: string(), done: boolean(), assignee: object({ name: string() }) })),
	});

	function seed() {
		const sizes = [100, 1_000, 10_000];

		return sizes.map((size) => {
			const store = new Store(schema);

			store.update((draft) => {
				draft.tickets = Array.from({ length: size }, (_, index) => ({
					title: `Ticket ${index}`,
					done: false,
					assignee: { name: "Ann" },
				}));
			});
			store.read();

			return { name: `${size.toLocaleString("en-US")} items`, store, last: size - 1 };
		});
	}

	describe("Update", () => {
		it("changes a nested field", ({ bench }) =>
			bench.compare(
				...seed().map(({ name, store, last }) =>
					bench(name, () =>
						store.update((draft) => {
							draft.tickets[last].done = !draft.tickets[last].done;
						}),
					),
				),
				options,
			));

		it("writes an equal value", ({ bench }) =>
			bench.compare(
				...seed().map(({ name, store, last }) =>
					bench(name, () =>
						store.update((draft) => {
							draft.tickets[last].done = false;
						}),
					),
				),
				options,
			));
	});

	describe("Read", () => {
		it("returns a cached item", ({ bench }) =>
			bench.compare(...seed().map(({ name, store, last }) => bench(name, () => store.read().tickets[last])), options));

		it("rebuilds after a change", ({ bench }) =>
			bench.compare(
				...seed().map(({ name, store, last }) =>
					bench(
						name,
						{
							beforeEach() {
								store.update((draft) => {
									draft.tickets[last].done = !draft.tickets[last].done;
								});
							},
						},
						() => store.read().tickets[last],
					),
				),
				options,
			));
	});
});
