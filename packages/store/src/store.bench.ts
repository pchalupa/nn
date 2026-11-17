import { array, boolean, object, string } from "@nn/schema";
import { describe, it } from "vitest";

import { Store } from "./store";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };

describe("Store", () => {
	const schema = object({ tickets: array(object({ title: string(), done: boolean() })) });

	function createTickets() {
		return Array.from({ length: 1_000 }, (_, index) => ({ title: `Ticket ${index}`, done: false }));
	}

	function createStore() {
		const store = new Store(schema);

		store.update((draft) => {
			draft.tickets = createTickets();
		});
		store.read();

		return store;
	}

	it("creates a list of 1,000 items", async ({ bench }) => {
		let store = new Store(schema);

		await bench(
			"store.update()",
			{
				beforeEach() {
					store = new Store(schema);
				},
			},
			() =>
				store.update((draft) => {
					draft.tickets = createTickets();
				}),
		).run(options);
	});

	it("updates one field in a list of 1,000 items", async ({ bench }) => {
		const store = createStore();

		await bench("store.update()", () =>
			store.update((draft) => {
				draft.tickets[0].done = !draft.tickets[0].done;
			})).run(options);
	});

	it("removes an item from a list of 1,000 items", async ({ bench }) => {
		let store = createStore();

		await bench(
			"store.update()",
			{
				beforeEach() {
					store = createStore();
				},
			},
			() =>
				store.update((draft) => {
					draft.tickets.splice(0, 1);
				}),
		).run(options);
	});

	it("reads a changed list of 1,000 items", async ({ bench }) => {
		const store = createStore();

		await bench(
			"store.read()",
			{
				beforeEach() {
					store.update((draft) => {
						draft.tickets[0].done = !draft.tickets[0].done;
					});
				},
			},
			() => store.read(),
		).run(options);
	});
});
