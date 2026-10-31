import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import { array, object, string } from "@nn/schema";
import { describe, expect, it } from "vitest";

import { State } from "./State";
import { Store } from "./Store";

describe("Store", () => {
	it("creates an store from schema", async ({ bench }) => {
		const schema = object({
			users: array(object({ name: string() })),
			posts: array(object({ title: string() })),
		});

		const result = await bench("fromSchema", async () => {
			await Store.fromSchema({ schema });
		}).run();

		expect(result.throughput.mean).toBeGreaterThan(850_000);
	});
});

describe.each([100, 10_000])("Root snapshots with %i rows", (size) => {
	it("measures root reconciliation for nested updates", async ({ bench }) => {
		const rows = Array.from({ length: size }, (_, index) => {
			const key = String(index);
			return new LWWRegister({ key, title: `Ticket ${index}`, assignee: { name: "Ann" } }, key);
		});
		const state = State.fromEntries({ tickets: new RGA(rows) });
		const last = rows[size - 1];
		state.read(["tickets"]);
		await bench.compare(
			bench("changed nested field", () =>
				state.write(["tickets", last.key, "assignee", "name"], (name) => (name === "Ann" ? "Bob" : "Ann"))),
			bench("equal nested field", () => state.write(["tickets", last.key, "assignee", "name"], (name) => name)),
			{ time: 0, iterations: 32, warmupTime: 0, warmupIterations: 8 },
		);
		expect(state.read(["tickets"])).toHaveLength(size);
		expect(rows[0].current.title).toBe("Ticket 0");
	});

	it("measures cached reads and full-root rebuilds", async ({ bench }) => {
		const rows = Array.from({ length: size }, (_, index) => {
			const key = String(index);
			return new LWWRegister({ key, title: `Ticket ${index}`, assignee: { name: "Ann" } }, key);
		});
		const state = State.fromEntries({ tickets: new RGA(rows) });
		const last = rows[size - 1];
		state.read(["tickets"]);

		await bench.compare(
			bench("cached collection", () => state.read(["tickets"])),
			bench("cached last row", () => state.read(["tickets", last.key])),
			bench(
				"row read rebuilding the root",
				{ beforeEach: () => void (last.current = { ...last.current, title: "Changed" }) },
				() => state.read(["tickets", last.key]),
			),
			{ time: 0, iterations: 32, warmupTime: 0, warmupIterations: 8 },
		);
		expect(state.read(["tickets"])).toHaveLength(size);
		expect(state.read(["tickets", last.key, "title"])).toBe("Changed");
	});
});
