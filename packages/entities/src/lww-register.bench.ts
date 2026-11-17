import { Time } from "@nn/time";
import { describe, it } from "vitest";

import { Codec } from "./codec";
import { LWWRegister } from "./lww-register";

const options = { time: 0, iterations: 256, warmupTime: 0, warmupIterations: 64 };
const timestamp = new Time(Date.UTC(2026, 0, 1), 0, "00000000-0000-4000-8000-000000000001");

describe("LWWRegister", () => {
	it("encodes and decodes a register", async ({ bench }) => {
		const codec = new Codec();
		const register = new LWWRegister("Value", "register", timestamp);

		await bench("codec.decode(register.encode())", () => codec.decode(register.encode())).run(options);
	});

	it("merges an equal register", async ({ bench }) => {
		const register = new LWWRegister("Value", "register", timestamp);
		const remote = new LWWRegister(register.current, register.key, register.timestamp);

		await bench("register.merge(remote)", () => register.merge(remote)).run(options);
	});
});
