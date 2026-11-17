import { describe, it } from "vitest";

import { Codec } from "./codec";
import { LWWRegister } from "./lww-register";
import { RGA } from "./rga";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };

describe("RGA", () => {
	it("encodes and decodes a list of 1,000 items", async ({ bench }) => {
		const codec = new Codec();
		const list = new RGA(Array.from({ length: 1_000 }, (_, index) => new LWWRegister(`Ticket ${index}`)));

		await bench("codec.decode(list.encode())", () => codec.decode(list.encode())).run(options);
	});

	it("merges an equal list of 1,000 items", async ({ bench }) => {
		const list = new RGA(Array.from({ length: 1_000 }, (_, index) => new LWWRegister(`Ticket ${index}`)));
		const remote = list.map((item) => new LWWRegister(item.current, item.key, item.timestamp));

		await bench("list.merge(remote)", () => list.merge(remote)).run(options);
	});
});
