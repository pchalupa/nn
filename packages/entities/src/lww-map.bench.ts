import { Time } from "@nn/time";
import { describe, it } from "vitest";

import { Codec } from "./codec";
import { LWWMap } from "./lww-map";
import { LWWRegister } from "./lww-register";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };
const timestamp = new Time(Date.UTC(2026, 0, 1), 0, "00000000-0000-4000-8000-000000000001");

function createFields() {
	return Array.from({ length: 1_000 }, (_, index) => new LWWRegister(`Value ${index}`, `field${index}`, timestamp));
}

describe("LWWMap", () => {
	it("encodes and decodes a map of 1,000 fields", async ({ bench }) => {
		const codec = new Codec();
		const map = new LWWMap(Object.fromEntries(createFields().map((field) => [field.key, field])), "map");

		await bench("codec.decode(map.encode())", () => codec.decode(map.encode())).run(options);
	});

	it("merges an equal map of 1,000 fields", async ({ bench }) => {
		const fields = createFields();
		const map = new LWWMap(Object.fromEntries(fields.map((field) => [field.key, field])), "map");
		const remote = new LWWMap(
			Object.fromEntries(
				fields.map((field) => [field.key, new LWWRegister(field.current, field.key, field.timestamp)]),
			),
			"map",
		);

		await bench("map.merge(remote)", () => map.merge(remote)).run(options);
	});
});
