import { array, boolean, object, string } from "@nn/schema";
import { describe, it } from "vitest";

import { State } from "./state";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };

describe("Store", () => {
	const schema = object({
		tickets: array(object({ title: string(), done: boolean(), assignee: object({ name: string() }) })),
	});

	function seed() {
		const sizes = [100, 1_000, 10_000];

		return sizes.map((size) => {
			const state = new State(schema);

			state.update((draft) => {
				draft.tickets = Array.from({ length: size }, (_, index) => ({
					title: `Ticket ${index}`,
					done: false,
					assignee: { name: "Ann" },
				}));
			});
			state.read();

			return { name: `${size.toLocaleString("en-US")} items`, state, last: size - 1 };
		});
	}

	describe("Update", () => {
		it("changes a nested field", ({ bench }) =>
			bench.compare(
				...seed().map(({ name, state, last }) =>
					bench(name, () =>
						state.update((draft) => {
							draft.tickets[last].done = !draft.tickets[last].done;
						}),
					),
				),
				options,
			));

		it("writes an equal value", ({ bench }) =>
			bench.compare(
				...seed().map(({ name, state, last }) =>
					bench(name, () =>
						state.update((draft) => {
							draft.tickets[last].done = false;
						}),
					),
				),
				options,
			));
	});

	describe("Read", () => {
		it("returns a cached item", ({ bench }) =>
			bench.compare(...seed().map(({ name, state, last }) => bench(name, () => state.read().tickets[last])), options));

		it("rebuilds after a change", ({ bench }) =>
			bench.compare(
				...seed().map(({ name, state, last }) =>
					bench(
						name,
						{
							beforeEach() {
								state.update((draft) => {
									draft.tickets[last].done = !draft.tickets[last].done;
								});
							},
						},
						() => state.read().tickets[last],
					),
				),
				options,
			));
	});
});
