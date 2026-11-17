import { Time } from "@nn/time";
import { describe, it } from "vitest";

import { Codec } from "./codec";
import { LWWRegister } from "./lww-register";
import { RGA } from "./rga";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };
const timestamp = new Time(Date.UTC(2026, 0, 1), 0, "00000000-0000-4000-8000-000000000001");

function createList() {
	return new RGA(
		Array.from({ length: 1_000 }, (_, index) => new LWWRegister(`Ticket ${index}`, `item${index}`, timestamp)),
		"list",
	);
}

describe("RGA", () => {
	it("encodes and decodes a list of 1,000 items", async ({ bench }) => {
		const codec = new Codec();
		const list = createList();

		await bench("codec.decode(list.encode())", () => codec.decode(list.encode())).run(options);
	});

	it("merges an equal list of 1,000 items", async ({ bench }) => {
		const list = createList();
		const remote = list.map((item) => new LWWRegister(item.current, item.key, item.timestamp));

		await bench("list.merge(remote)", () => list.merge(remote)).run(options);
	});
});
