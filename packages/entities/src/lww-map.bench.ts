import { describe, it } from "vitest";

import { Codec } from "./codec";
import { LWWMap } from "./lww-map";
import { LWWRegister } from "./lww-register";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };

describe("LWWMap", () => {
	it("encodes and decodes a map of 1,000 fields", async ({ bench }) => {
		const fields = Array.from({ length: 1_000 }, (_, index) => new LWWRegister(`Value ${index}`, `field${index}`));
		const codec = new Codec();
		const map = new LWWMap(Object.fromEntries(fields.map((field) => [field.key, field])));

		await bench("codec.decode(map.encode())", () => codec.decode(map.encode())).run(options);
	});

	it("merges an equal map of 1,000 fields", async ({ bench }) => {
		const fields = Array.from({ length: 1_000 }, (_, index) => new LWWRegister(`Value ${index}`, `field${index}`));
		const map = new LWWMap(Object.fromEntries(fields.map((field) => [field.key, field])));
		const remote = new LWWMap(
			Object.fromEntries(
				fields.map((field) => [field.key, new LWWRegister(field.current, field.key, field.timestamp)]),
			),
		);

		await bench("map.merge(remote)", () => map.merge(remote)).run(options);
	});
});
