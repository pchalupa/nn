import { array, object, string } from "@nn/schema";
import { describe, expect, it } from "vitest";

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

		expect(result.throughput.mean).toBeGreaterThan(1_000_000);
	});
});
