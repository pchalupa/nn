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

		store.mutate((draft) => {
			draft.tickets = createTickets();
		});
		store.query((state) => state);

		return store;
	}

	it("creates a list of 1,000 items", async ({ bench }) => {
		let store = new Store(schema);
		let tickets = createTickets();

		await bench(
			"store.mutate()",
			{
				beforeEach() {
					store = new Store(schema);
					tickets = createTickets();
				},
			},
			() =>
				store.mutate((draft) => {
					draft.tickets = tickets;
				}),
		).run(options);
	});

	it("mutates one field in a list of 1,000 items", async ({ bench }) => {
		const store = createStore();

		await bench("store.mutate()", () =>
			store.mutate((draft) => {
				draft.tickets[0].done = !draft.tickets[0].done;
			})).run(options);
	});

	it("removes an item from a list of 1,000 items", async ({ bench }) => {
		let store = createStore();

		await bench(
			"store.mutate()",
			{
				beforeEach() {
					store = createStore();
				},
			},
			() =>
				store.mutate((draft) => {
					draft.tickets.splice(0, 1);
				}),
		).run(options);
	});

	it("reads a changed list of 1,000 items", async ({ bench }) => {
		const store = createStore();

		await bench(
			"store.query((state) => state)",
			{
				beforeEach() {
					store.mutate((draft) => {
						draft.tickets[0].done = !draft.tickets[0].done;
					});
				},
			},
			() => store.query((state) => state),
		).run(options);
	});
});
