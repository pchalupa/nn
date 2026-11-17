import { describe, it } from "vitest";

import { Codec } from "./codec";
import { LWWRegister } from "./lww-register";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };

describe("LWWRegister", () => {
	it("encodes and decodes a register", async ({ bench }) => {
		const codec = new Codec();
		const register = new LWWRegister("Value");

		await bench("codec.decode(register.encode())", () => codec.decode(register.encode())).run(options);
	});

	it("merges an equal register", async ({ bench }) => {
		const register = new LWWRegister("Value");
		const remote = new LWWRegister(register.current, register.key, register.timestamp);

		await bench("register.merge(remote)", () => register.merge(remote)).run(options);
	});
});
